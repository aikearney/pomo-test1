import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import path from "node:path";
import { v4 as uuid } from "uuid";
import session from "express-session";
import passport from "passport";
import { getUserId } from "./shared/auth";
import { getListsContainer, getTasksContainer } from "./shared/cosmos";
import { isOAuthProviderConfigured, getConfiguredProviders } from "./shared/oauth";

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 7071);
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.resolve(process.cwd(), "../../dist");

// Session configuration for OAuth state management
const sessionSecret = process.env.SESSION_SECRET || "dev-secret-change-in-production";
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

function getAuthenticatedUserId(req: Request): string | undefined {
  // First check for Azure Easy Auth headers (when running in App Service)
  const easyAuthUser = getUserId({ headers: req.headers });
  if (easyAuthUser) {
    return easyAuthUser;
  }

  // Fall back to passport-authenticated user
  const passportUser = (req.user as any);
  if (passportUser?.id) {
    return passportUser.id;
  }

  return undefined;
}

// Wrapper to catch Cosmos connection errors gracefully
function asyncHandler(fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next?: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error("API Error:", error.message);
      if (error.message.includes("Missing required setting") || error.message.includes("COSMOS")) {
        res.status(503).json({
          error: "Service unavailable",
          message: "Database connection not configured. Frontend still available.",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    });
  };
}

// ===== Auth Endpoints =====

// GET /.auth/me - Get current authentication info
app.get("/.auth/me", (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const user = (req.user as any) || null;

  if (!userId && !user) {
    res.status(401).json({ statusCode: 401 });
    return;
  }

  // Return auth info in the format expected by the frontend
  const authInfo = [
    {
      user_id: userId || user?.id || "unknown",
      user_claims: [
        {
          typ: "name",
          val: user?.displayName || "User",
        },
        {
          typ: "preferred_username",
          val: user?.email || user?.id,
        },
      ],
    },
  ];

  res.status(200).json(authInfo);
});

// GET /.auth/login/:provider - Initiate OAuth login
app.get("/.auth/login/:provider", (req: Request, res: Response, next: NextFunction) => {
  const provider = req.params.provider as string;
  const redirect = req.query.post_login_redirect_uri as string;

  // Store the post-login redirect URI in the session
  if (redirect) {
    req.session.postLoginRedirect = redirect;
  }

  if (!isOAuthProviderConfigured(provider)) {
    console.warn(`OAuth provider '${provider}' is not configured`);
    res.status(400).json({
      error: "Provider not configured",
      message: `OAuth provider '${provider}' is not configured. Configured providers: ${getConfiguredProviders().join(", ")}`,
    });
    return;
  }

  // Use passport to authenticate with the OAuth provider
  passport.authenticate(provider, {
    scope: provider === "google"
      ? ["profile", "email"]
      : provider === "facebook"
        ? ["public_profile", "email"]
        : ["profile", "email"],
  })(req, res, next);
});

// GET /.auth/callback/:provider - OAuth callback
app.get(
  "/.auth/callback/:provider",
  (req: Request, res: Response, next: NextFunction) => {
    const provider = req.params.provider as string;

    passport.authenticate(provider, {
      failureRedirect: `/?error=auth_failed&provider=${provider}`,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    // Authentication successful
    const redirect = req.session.postLoginRedirect || "/";
    delete req.session.postLoginRedirect;
    res.redirect(redirect);
  }
);

// GET /.auth/logout - Logout
app.get("/.auth/logout", (req: Request, res: Response, next: NextFunction) => {
  const redirect = req.query.post_logout_redirect_uri as string;

  req.logout((err) => {
    if (err) {
      return next(err);
    }

    req.session.destroy(() => {
      res.redirect(redirect || "/");
    });
  });
});

// ===== API Routes =====


app.get("/api/lists", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    // Keep anonymous behavior stable for the existing frontend contract.
    res.status(200).json([
      {
        id: "personal",
        name: "Personal",
        createdAt: 0,
        color: null,
        order: 0,
        pinned: false,
        isLocal: true,
      },
    ]);
    return;
  }

  const lists = getListsContainer();
  const query = "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.order ASC";
  const { resources } = await lists.items
    .query({ query, parameters: [{ name: "@userId", value: userId }] })
    .fetchAll();

  res.status(200).json(resources);
}));

app.post("/api/lists", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  if (!req.body?.name) {
    res.status(400).send("Missing list name");
    return;
  }

  const newList = {
    id: uuid(),
    userId: userId as string,
    name: req.body.name,
    createdAt: Date.now(),
    color: req.body.color ?? null,
    order: req.body.order ?? Date.now(),
    pinned: req.body.pinned ?? false,
  };

  await getListsContainer().items.create(newList);
  res.status(201).json(newList);
}));

app.patch("/api/lists/:id", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id as string;
  const lists = getListsContainer();
  const { resource: list } = await lists.item(listId, userId as string).read();

  if (!list) {
    res.status(404).send("List not found");
    return;
  }

  const updated = { ...list, ...(req.body ?? {}) };
  await lists.item(listId, userId as string).replace(updated);
  res.status(200).json(updated);
}));

app.delete("/api/lists/:id", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id as string;
  const lists = getListsContainer();
  const tasks = getTasksContainer();

  const { resource: list } = await lists.item(listId, userId as string).read();
  if (!list) {
    res.status(404).send("List not found");
    return;
  }

  const query = "SELECT c.id FROM c WHERE c.userId = @userId AND c.listId = @listId";
  const { resources } = await tasks.items
    .query({
      query,
      parameters: [
        { name: "@userId", value: userId },
        { name: "@listId", value: listId },
      ],
    })
    .fetchAll();

  await Promise.all(resources.map((task) => tasks.item(task.id, userId as string).delete()));
  await lists.item(listId, userId as string).delete();

  res.status(204).send();
}));

app.get("/api/lists/:id/tasks", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id as string;
  const lists = getListsContainer();
  const tasks = getTasksContainer();

  const { resource: list } = await lists.item(listId, userId as string).read();
  if (!list) {
    res.status(404).send("List not found");
    return;
  }

  const query =
    "SELECT * FROM c WHERE c.userId = @userId AND c.listId = @listId ORDER BY c.createdAt ASC";
  const { resources } = await tasks.items
    .query({
      query,
      parameters: [
        { name: "@userId", value: userId },
        { name: "@listId", value: listId },
      ],
    })
    .fetchAll();

  res.status(200).json(resources);
}));

app.post("/api/lists/:id/tasks", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id as string;
  const lists = getListsContainer();

  const { resource: list } = await lists.item(listId, userId as string).read();
  if (!list) {
    res.status(404).send("List not found");
    return;
  }

  if (!req.body?.name) {
    res.status(400).send("Missing task name");
    return;
  }

  const newTask = {
    id: uuid(),
    userId: userId as string,
    listId,
    name: req.body.name,
    iterations: req.body.iterations ?? 1,
    subtasks: req.body.subtasks ?? [],
    completed: false,
    collapsed: false,
    isHighPriority: req.body.isHighPriority ?? false,
    createdAt: Date.now(),
  };

  await getTasksContainer().items.create(newTask);
  res.status(201).json(newTask);
}));

app.patch("/api/tasks/:id", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const taskId = req.params.id as string;
  const tasks = getTasksContainer();
  const { resource: task } = await tasks.item(taskId, userId as string).read();

  if (!task) {
    res.status(404).send("Task not found");
    return;
  }

  const updated = { ...task, ...(req.body ?? {}) };
  await tasks.item(taskId, userId as string).replace(updated);
  res.status(200).json(updated);
}));

app.delete("/api/tasks/:id", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const taskId = req.params.id as string;
  const tasks = getTasksContainer();
  const { resource: task } = await tasks.item(taskId, userId as string).read();

  if (!task) {
    res.status(404).send("Task not found");
    return;
  }

  await tasks.item(taskId, userId as string).delete();
  res.status(204).send();
}));

app.use("/api", (_req, res) => {
  res.status(404).send("Not found");
});

app.use(express.static(frontendDistPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"), (error) => {
    if (error) {
      res.status(404).send("Frontend build not found. Build the frontend before starting the server.");
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Serving frontend assets from: ${frontendDistPath}`);
});
