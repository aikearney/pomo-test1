import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { getUserId } from "./shared/auth";
import { getListsContainer, getTasksContainer } from "./shared/cosmos";

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 7071);
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.resolve(process.cwd(), "../../dist");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getAuthenticatedUserId(req: Request): string | undefined {
  return getUserId({ headers: req.headers });
}

const USER_ID_FILTER = "(c.userId = @userId OR c.userid = @userId)";

function getHeaderValue(req: Request, name: string): string | undefined {
  const direct = req.headers[name.toLowerCase()];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }
  if (Array.isArray(direct)) {
    const first = direct.find((value) => typeof value === "string" && value.length > 0);
    if (typeof first === "string") {
      return first;
    }
  }
  return undefined;
}

function parseClientPrincipalHeader(encodedPrincipal: string): any | undefined {
  const trimmed = encodedPrincipal.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    try {
      const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    } catch {
      return undefined;
    }
  }
}

function getClaimValue(principal: any, claimTypes: string[]): string | undefined {
  const claims = principal?.claims;
  if (!Array.isArray(claims)) {
    return undefined;
  }

  const wanted = new Set(claimTypes.map((type) => type.toLowerCase()));
  const match = claims.find((entry: any) =>
    wanted.has(String(entry?.typ || entry?.type || "").toLowerCase())
  );

  const value = match?.val || match?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Safe auth endpoint - proxies /.auth/me but strips sensitive tokens
app.get("/api/auth/me", asyncHandler(async (req, res) => {
  try {
    const principalHeader = getHeaderValue(req, "x-ms-client-principal");
    const principalId = getHeaderValue(req, "x-ms-client-principal-id");
    const providerNameHeader = getHeaderValue(req, "x-ms-client-principal-idp");

    const decodedPrincipal = principalHeader
      ? parseClientPrincipalHeader(principalHeader)
      : undefined;

    let principal = decodedPrincipal
      ? {
          user_id:
            principalId ||
            getClaimValue(decodedPrincipal, [
              "sub",
              "oid",
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
              "http://schemas.microsoft.com/identity/claims/objectidentifier",
            ]) ||
            decodedPrincipal.userId ||
            decodedPrincipal.userDetails ||
            null,
          user_claims: Array.isArray(decodedPrincipal.claims)
            ? decodedPrincipal.claims
            : [],
          provider_name:
            providerNameHeader ||
            decodedPrincipal.identityProvider ||
            decodedPrincipal.auth_typ ||
            null,
        }
      : undefined;

    // Fallback path when principal headers are unavailable in this hosting setup.
    if (!principal?.user_id) {
      const forwardedProto = getHeaderValue(req, "x-forwarded-proto") || req.protocol;
      const host = getHeaderValue(req, "x-forwarded-host") || req.get("host");

      if (!host) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const response = await fetch(`${forwardedProto}://${host}/.auth/me`, {
        headers: {
          cookie: getHeaderValue(req, "cookie") || "",
          "x-ms-client-principal": principalHeader || "",
          "x-ms-client-principal-id": principalId || "",
          "x-ms-client-principal-name": getHeaderValue(req, "x-ms-client-principal-name") || "",
        },
      });

      if (!response.ok) {
        res.status(response.status).json({ error: "Unauthorized" });
        return;
      }

      const authInfo = await response.json();
      principal = Array.isArray(authInfo) ? authInfo[0] : undefined;
    }

    if (!principal?.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Strip sensitive tokens - return only safe claims
    const safeResponse = [
      {
        user_id: principal.user_id,
        user_claims: principal.user_claims || [],
        provider_name: principal.provider_name,
        // Do NOT include: access_token, refresh_token, expires_on
      },
    ];

    res.status(200).json(safeResponse);
  } catch (error: any) {
    console.error("Auth proxy error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}));

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
  const query = `SELECT * FROM c WHERE ${USER_ID_FILTER}`;
  const { resources } = await lists.items
    .query({ query, parameters: [{ name: "@userId", value: userId }] })
    .fetchAll();

  const orderedResources = resources
    .slice()
    .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));

  res.status(200).json(orderedResources);
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
    userid: userId as string,
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

  const updated = {
    ...list,
    ...(req.body ?? {}),
    userId: userId as string,
    userid: userId as string,
  };
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

  const query =
    "SELECT c.id FROM c WHERE (c.userId = @userId OR c.userid = @userId) AND c.listId = @listId";
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
    "SELECT * FROM c WHERE (c.userId = @userId OR c.userid = @userId) AND c.listId = @listId";
  const { resources } = await tasks.items
    .query({
      query,
      parameters: [
        { name: "@userId", value: userId },
        { name: "@listId", value: listId },
      ],
    })
    .fetchAll();

  const orderedResources = resources
    .slice()
    .sort((a: any, b: any) => Number(a?.createdAt ?? 0) - Number(b?.createdAt ?? 0));

  res.status(200).json(orderedResources);
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

  const body = req.body ?? {};
  const taskIterations = Number(body.iterations);
  const completedIterations = Number(body.completedIterations);
  const subtasks = Array.isArray(body.subtasks)
    ? body.subtasks.map((subtask: any) => ({
        ...subtask,
        iterations: Number.isFinite(Number(subtask?.iterations)) && Number(subtask?.iterations) > 0
          ? Math.round(Number(subtask?.iterations))
          : 1,
        completed: Boolean(subtask?.completed),
      }))
    : [];

  const newTask = {
    id: uuid(),
    userId: userId as string,
    userid: userId as string,
    listId,
    name: body.name,
    iterations: Number.isFinite(taskIterations) && taskIterations > 0
      ? Math.round(taskIterations)
      : 1,
    subtasks,
    completed: Boolean(body.completed),
    completedIterations: Number.isFinite(completedIterations) && completedIterations >= 0
      ? Math.round(completedIterations)
      : 0,
    collapsed: Boolean(body.collapsed),
    isHighPriority: body.isHighPriority ?? false,
    recurrence: body.recurrence ?? undefined,
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

  const updated = {
    ...task,
    ...(req.body ?? {}),
    userId: userId as string,
    userid: userId as string,
  };
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

// Facebook data deletion instructions page (set this URL in Facebook app settings)
app.get("/auth/data-deletion", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host") || "pomo.azurewebsites.net";
  const appUrl = `${proto}://${host}`;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Data Deletion - Pomodoro Timer</title>
<style>body{font-family:sans-serif;max-width:600px;margin:60px auto;padding:0 20px;line-height:1.6}</style>
</head>
<body>
<h1>Delete Your Data</h1>
<p>To delete all your data from Pomodoro Timer (lists, tasks, and account information), you have two options:</p>
<h2>Option 1 — Self-service (instant)</h2>
<ol>
<li>Log in to <a href="${appUrl}">Pomodoro Timer</a>.</li>
<li>Delete each of your lists from the list selector dropdown.</li>
<li>Log out. Your data is removed.</li>
</ol>
<h2>Option 2 — Contact us</h2>
<p>Email <a href="mailto:aisling@kearney.ie">aisling@kearney.ie</a> with subject <strong>Data Deletion Request</strong>. We will delete your data within 30 days and confirm by email.</p>
<p><small>We only store task lists and tasks you create. We do not store payment data or share your data with third parties.</small></p>
</body></html>`);
});

// Facebook data deletion callback (called by Facebook when a user removes the app)
app.post("/auth/data-deletion", asyncHandler(async (req, res) => {
  const signedRequest = req.body?.signed_request as string | undefined;

  if (!signedRequest) {
    res.status(400).json({ error: "Missing signed_request" });
    return;
  }

  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    console.error("FACEBOOK_APP_SECRET not configured");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  // Parse and verify Facebook signed_request
  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) {
    res.status(400).json({ error: "Malformed signed_request" });
    return;
  }

  const normalize = (s: string) =>
    s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64");

  const receivedSig = Buffer.from(normalize(encodedSig), "base64").toString("base64");
  if (expectedSig !== receivedSig) {
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(normalize(encodedPayload), "base64").toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const facebookUserId = payload?.user_id as string | undefined;
  if (!facebookUserId) {
    res.status(400).json({ error: "Missing user_id in payload" });
    return;
  }

  // Delete all data for this user (userId stored as Facebook numeric ID from Easy Auth)
  try {
    const lists = getListsContainer();
    const tasks = getTasksContainer();

    const { resources: userLists } = await lists.items
      .query({
        query: `SELECT c.id FROM c WHERE ${USER_ID_FILTER}`,
        parameters: [{ name: "@userId", value: facebookUserId }],
      })
      .fetchAll();

    await Promise.all(
      userLists.map(async (list: any) => {
        // Delete all tasks in this list
        const { resources: listTasks } = await tasks.items
          .query({
            query: "SELECT c.id FROM c WHERE (c.userId = @userId OR c.userid = @userId) AND c.listId = @listId",
            parameters: [
              { name: "@userId", value: facebookUserId },
              { name: "@listId", value: list.id },
            ],
          })
          .fetchAll();

        await Promise.all(listTasks.map((t: any) => tasks.item(t.id, facebookUserId).delete()));
        await lists.item(list.id, facebookUserId).delete();
      })
    );

    console.log(`Data deletion completed for Facebook user ${facebookUserId}: ${userLists.length} lists removed`);
  } catch (err: any) {
    console.error("Data deletion error:", err.message);
    // Still return success — Facebook only retries on 5xx. Log for manual followup.
  }

  const confirmationCode = uuid();
  const host = req.get("host") || "pomo.azurewebsites.net";
  const proto = req.headers["x-forwarded-proto"] || req.protocol;

  res.status(200).json({
    url: `${proto}://${host}/auth/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}));

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
