import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { getUserId } from "./shared/auth";
import { getListsContainer, getTasksContainer, getUserPreferencesContainer } from "./shared/cosmos";

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 7071);
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.resolve(process.cwd(), "../../dist");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/healthz", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

const USER_ID_FILTER = "(c.userId = @userId OR c.userid = @userId)";
const USER_PREFERENCES_DOC_ID = "preferences";

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

async function fetchAuthPrincipalFromEasyAuth(req: Request): Promise<any | undefined> {
  const principalHeader = getHeaderValue(req, "x-ms-client-principal");
  const principalId = getHeaderValue(req, "x-ms-client-principal-id");

  const forwardedProto = getHeaderValue(req, "x-forwarded-proto") || req.protocol;
  const host = getHeaderValue(req, "x-forwarded-host") || req.get("host");

  if (!host) {
    return undefined;
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
    return undefined;
  }

  const authInfo = await response.json();
  return Array.isArray(authInfo) ? authInfo[0] : undefined;
}

async function getAuthenticatedUserId(req: Request): Promise<string | undefined> {
  const fromHeaders = getUserId({ headers: req.headers });
  if (fromHeaders) {
    return fromHeaders;
  }

  try {
    const principal = await fetchAuthPrincipalFromEasyAuth(req);
    const userId = typeof principal?.user_id === "string" ? principal.user_id : undefined;
    return userId && userId.length > 0 ? userId : undefined;
  } catch {
    return undefined;
  }
}

function normalizeBackgroundOpacity(value: unknown, fallback = 0.8): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
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
            (typeof decodedPrincipal.userId === "string" && decodedPrincipal.userId.length > 0
              ? decodedPrincipal.userId
              : null) ||
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
      principal = await fetchAuthPrincipalFromEasyAuth(req);
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

app.get("/api/preferences", asyncHandler(async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const container = getUserPreferencesContainer();
  const { resource } = await container.item(USER_PREFERENCES_DOC_ID, userId).read();

  if (!resource) {
    res.status(200).json({
      backgroundImage: null,
      backgroundOpacity: 0.8,
    });
    return;
  }

  res.status(200).json({
    backgroundImage: typeof resource.backgroundImage === "string" ? resource.backgroundImage : null,
    backgroundOpacity: normalizeBackgroundOpacity(resource.backgroundOpacity),
  });
}));

app.patch("/api/preferences", asyncHandler(async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "backgroundImage")) {
    if (body.backgroundImage !== null && typeof body.backgroundImage !== "string") {
      res.status(400).send("backgroundImage must be a string or null");
      return;
    }

    if (typeof body.backgroundImage === "string" && body.backgroundImage.length > 1024) {
      res.status(400).send("backgroundImage value is too large");
      return;
    }

    updates.backgroundImage = body.backgroundImage;
  }

  if (Object.prototype.hasOwnProperty.call(body, "backgroundOpacity")) {
    const parsed = Number(body.backgroundOpacity);
    if (!Number.isFinite(parsed)) {
      res.status(400).send("backgroundOpacity must be a number between 0 and 1");
      return;
    }

    updates.backgroundOpacity = Math.min(1, Math.max(0, parsed));
  }

  const container = getUserPreferencesContainer();
  const { resource: existing } = await container.item(USER_PREFERENCES_DOC_ID, userId).read();
  const now = Date.now();
  const createdAt = Number(existing?.createdAt) || now;

  const nextDocument = {
    id: USER_PREFERENCES_DOC_ID,
    backgroundImage: null,
    backgroundOpacity: 0.8,
    ...(existing ?? {}),
    ...updates,
    userId,
    userid: userId,
    createdAt,
    updatedAt: now,
  };

  if (existing) {
    const { resource: saved } = await container.item(USER_PREFERENCES_DOC_ID, userId).replace(nextDocument);
    res.status(200).json({
      backgroundImage: typeof saved?.backgroundImage === "string" ? saved.backgroundImage : null,
      backgroundOpacity: normalizeBackgroundOpacity(saved?.backgroundOpacity),
    });
    return;
  }

  const { resource: created } = await container.items.create(nextDocument);
  res.status(200).json({
    backgroundImage: typeof created?.backgroundImage === "string" ? created.backgroundImage : null,
    backgroundOpacity: normalizeBackgroundOpacity(created?.backgroundOpacity),
  });
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
  const userId = await getAuthenticatedUserId(req);

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
  const userId = await getAuthenticatedUserId(req);
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
  const userId = await getAuthenticatedUserId(req);
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
  const userId = await getAuthenticatedUserId(req);
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
  const userId = await getAuthenticatedUserId(req);
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
    .sort((a: any, b: any) => {
      const aOrder = Number(a?.order);
      const bOrder = Number(b?.order);
      const hasAOrder = Number.isFinite(aOrder);
      const hasBOrder = Number.isFinite(bOrder);

      if (hasAOrder && hasBOrder && aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      if (hasAOrder && !hasBOrder) return -1;
      if (!hasAOrder && hasBOrder) return 1;

      return Number(a?.createdAt ?? 0) - Number(b?.createdAt ?? 0);
    });

  res.status(200).json(orderedResources);
}));

app.post("/api/lists/:id/tasks", asyncHandler(async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
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
    order: Number.isFinite(Number(body.order)) ? Number(body.order) : Date.now(),
    createdAt: Date.now(),
  };

  await getTasksContainer().items.create(newTask);
  res.status(201).json(newTask);
}));

app.patch("/api/tasks/:id", asyncHandler(async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
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
  const userId = await getAuthenticatedUserId(req);
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

/**
 * GET /api/ai/lists/search
 * Search for task lists by name or retrieve all lists.
 * Query Parameters:
 *   - q: Search query (optional, exact match case-insensitive)
 *   - fuzzy: Enable fuzzy matching (optional, default false)
 *   - limit: Max results (optional, default 10, max 100)
 * Response: { lists, query, matchType, resultCount }
 */
app.get("/api/ai/lists/search", asyncHandler(async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }

  const searchQuery = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
  const fuzzyMode = req.query.fuzzy === "true";
  const limitParam = Number(req.query.limit ?? 10);

  // Validate limit
  if (!Number.isFinite(limitParam) || limitParam < 1 || limitParam > 100) {
    res.status(400).json({
      error: "INVALID_QUERY",
      message: "limit must be between 1 and 100",
      received: req.query.limit,
    });
    return;
  }

  const lists = getListsContainer();
  const query = `SELECT * FROM c WHERE ${USER_ID_FILTER} ORDER BY c.order ASC`;
  const { resources: allLists } = await lists.items
    .query({
      query,
      parameters: [{ name: "@userId", value: userId }],
    })
    .fetchAll();

  let filteredLists = allLists;
  let matchType = "all";

  // Apply search filter if query provided
  if (searchQuery) {
    if (fuzzyMode) {
      // Fuzzy matching: substring match (case-insensitive)
      const queryLower = searchQuery.toLowerCase();
      filteredLists = allLists.filter((list: any) =>
        list.name?.toLowerCase().includes(queryLower)
      );
      matchType = "fuzzy";
    } else {
      // Exact match (case-insensitive)
      const queryLower = searchQuery.toLowerCase();
      filteredLists = allLists.filter((list: any) =>
        list.name?.toLowerCase() === queryLower
      );
      matchType = "exact";
    }
  }

  // Limit results
  const results = filteredLists.slice(0, limitParam);

  // Get task counts for each list
  const tasks = getTasksContainer();
  const listsWithCounts = await Promise.all(
    results.map(async (list: any) => {
      const taskQuery = `SELECT VALUE COUNT(1) FROM c WHERE (c.userId = @userId OR c.userid = @userId) AND c.listId = @listId`;
      const { resources: countResult } = await tasks.items
        .query({
          query: taskQuery,
          parameters: [
            { name: "@userId", value: userId },
            { name: "@listId", value: list.id },
          ],
        })
        .fetchAll();

      const taskCount = countResult?.[0] ?? 0;

      return {
        id: list.id,
        name: list.name,
        createdAt: list.createdAt,
        color: list.color || null,
        order: list.order,
        pinned: list.pinned,
        taskCount,
      };
    })
  );

  res.status(200).json({
    lists: listsWithCounts,
    query: searchQuery || null,
    matchType,
    resultCount: listsWithCounts.length,
  });
}));

/**
 * POST /api/ai/tasks
 * Create one or more tasks with optional list auto-creation.
 * Request Body:
 *   {
 *     "listId": "uuid" | null,
 *     "listName": "Shopping",
 *     "createListIfMissing": boolean,
 *     "tasks": [
 *       {
 *         "name": "Task title",
 *         "iterations": 1,
 *         "isHighPriority": false,
 *         "subtasks": [...]
 *       }
 *     ]
 *   }
 * Response: 201 Created with { listId, listName, listCreated, tasksCreated, summary }
 * Errors: 400 (INVALID_REQUEST, BATCH_SIZE_EXCEEDED, LIST_NOT_FOUND, etc.)
 */
app.post("/api/ai/tasks", asyncHandler(async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }

  const body = req.body ?? {};
  const requestId = crypto.randomUUID?.() || uuid();

  // --- VALIDATION: Parse and validate request ---

  // Validate tasks array exists and is an array
  if (!Array.isArray(body.tasks)) {
    res.status(400).json({
      error: "INVALID_REQUEST",
      message: "tasks must be an array",
      field: "tasks",
      correlationId: requestId,
    });
    return;
  }

  // Validate batch size (1-50 tasks)
  if (body.tasks.length < 1 || body.tasks.length > 50) {
    res.status(400).json({
      error: "BATCH_SIZE_EXCEEDED",
      message: `Maximum 50 tasks per request. Received ${body.tasks.length}.`,
      correlationId: requestId,
    });
    return;
  }

  // Validate each task in the batch (all-or-nothing validation)
  for (let i = 0; i < body.tasks.length; i++) {
    const task = body.tasks[i];

    // Validate task name
    if (typeof task.name !== "string" || !task.name.trim()) {
      res.status(400).json({
        error: "INVALID_REQUEST",
        message: "tasks[" + i + "].name is required and must be non-empty",
        field: `tasks[${i}].name`,
        correlationId: requestId,
      });
      return;
    }

    if (task.name.length > 500) {
      res.status(400).json({
        error: "INVALID_REQUEST",
        message: "tasks[" + i + "].name must not exceed 500 characters",
        field: `tasks[${i}].name`,
        correlationId: requestId,
      });
      return;
    }

    // Validate iterations if provided
    if (task.hasOwnProperty("iterations")) {
      const iterations = Number(task.iterations);
      if (!Number.isFinite(iterations) || iterations < 1 || iterations > 100) {
        res.status(400).json({
          error: "INVALID_ITERATIONS",
          message: "iterations must be a positive integer between 1 and 100",
          field: `tasks[${i}].iterations`,
          received: task.iterations,
          correlationId: requestId,
        });
        return;
      }
    }

    // Validate subtasks if provided
    if (task.hasOwnProperty("subtasks")) {
      if (!Array.isArray(task.subtasks)) {
        res.status(400).json({
          error: "INVALID_REQUEST",
          message: "tasks[" + i + "].subtasks must be an array",
          field: `tasks[${i}].subtasks`,
          correlationId: requestId,
        });
        return;
      }

      if (task.subtasks.length > 20) {
        res.status(400).json({
          error: "INVALID_REQUEST",
          message: "tasks[" + i + "].subtasks must not exceed 20 items",
          field: `tasks[${i}].subtasks`,
          correlationId: requestId,
        });
        return;
      }

      for (let j = 0; j < task.subtasks.length; j++) {
        const subtask = task.subtasks[j];

        if (typeof subtask.name !== "string" || !subtask.name.trim()) {
          res.status(400).json({
            error: "INVALID_REQUEST",
            message: "tasks[" + i + "].subtasks[" + j + "].name is required and must be non-empty",
            field: `tasks[${i}].subtasks[${j}].name`,
            correlationId: requestId,
          });
          return;
        }

        if (subtask.name.length > 500) {
          res.status(400).json({
            error: "INVALID_REQUEST",
            message: "tasks[" + i + "].subtasks[" + j + "].name must not exceed 500 characters",
            field: `tasks[${i}].subtasks[${j}].name`,
            correlationId: requestId,
          });
          return;
        }

        // Validate subtask iterations if provided
        if (subtask.hasOwnProperty("iterations")) {
          const subtaskIterations = Number(subtask.iterations);
          if (!Number.isFinite(subtaskIterations) || subtaskIterations < 1 || subtaskIterations > 100) {
            res.status(400).json({
              error: "INVALID_ITERATIONS",
              message: "subtask iterations must be a positive integer between 1 and 100",
              field: `tasks[${i}].subtasks[${j}].iterations`,
              received: subtask.iterations,
              correlationId: requestId,
            });
            return;
          }
        }
      }
    }
  }

  // --- RESOLVE LIST ---

  const lists = getListsContainer();
  const tasks = getTasksContainer();
  let resolvedListId: string;
  let resolvedListName: string;
  let listCreated = false;

  // Determine list resolution strategy
  const providedListId = body.listId;
  const providedListName = typeof body.listName === "string" ? body.listName.trim() : undefined;
  const createListIfMissing = body.createListIfMissing === true;

  if (providedListId) {
    // Validate that list exists
    try {
      const { resource: list } = await lists.item(providedListId, userId as string).read();
      if (!list) {
        res.status(400).json({
          error: "LIST_NOT_FOUND",
          message: `List with ID '${providedListId}' not found`,
          correlationId: requestId,
        });
        return;
      }
      resolvedListId = list.id;
      resolvedListName = list.name;
    } catch (err: any) {
      res.status(400).json({
        error: "LIST_NOT_FOUND",
        message: `List with ID '${providedListId}' not found`,
        correlationId: requestId,
      });
      return;
    }
  } else if (providedListName) {
    // Search for list by name (exact match, case-insensitive)
    const queryName = providedListName.toLowerCase();
    const listQuery = `SELECT * FROM c WHERE (c.userId = @userId OR c.userid = @userId) AND LOWER(c.name) = @name`;
    const { resources: matchingLists } = await lists.items
      .query({
        query: listQuery,
        parameters: [
          { name: "@userId", value: userId },
          { name: "@name", value: queryName },
        ],
      })
      .fetchAll();

    if (matchingLists.length > 0) {
      // List found
      resolvedListId = matchingLists[0].id;
      resolvedListName = matchingLists[0].name;
    } else if (createListIfMissing) {
      // Auto-create list
      const newList = {
        id: uuid(),
        userId: userId as string,
        userid: userId as string,
        name: providedListName,
        createdAt: Date.now(),
        color: null,
        order: Date.now(),
        pinned: false,
      };
      await lists.items.create(newList);
      resolvedListId = newList.id;
      resolvedListName = newList.name;
      listCreated = true;
    } else {
      // List not found and auto-create disabled
      res.status(400).json({
        error: "LIST_NOT_FOUND_NO_AUTO_CREATE",
        message: `List '${providedListName}' not found. Set createListIfMissing=true to auto-create.`,
        listName: providedListName,
        correlationId: requestId,
      });
      return;
    }
  } else {
    res.status(400).json({
      error: "INVALID_REQUEST",
      message: "Either listId or listName must be provided",
      field: "listId or listName",
      correlationId: requestId,
    });
    return;
  }

  // --- CREATE TASKS ---

  const createdTasks = [];
  let totalSubtasks = 0;
  let totalPomodoros = 0;

  for (const taskInput of body.tasks) {
    const taskIterations = Number.isFinite(Number(taskInput.iterations)) && Number(taskInput.iterations) > 0
      ? Math.round(Number(taskInput.iterations))
      : 1;

    // Process subtasks
    const processedSubtasks = Array.isArray(taskInput.subtasks)
      ? taskInput.subtasks.map((subtask: any) => ({
          id: uuid(),
          name: subtask.name,
          iterations: Number.isFinite(Number(subtask.iterations)) && Number(subtask.iterations) > 0
            ? Math.round(Number(subtask.iterations))
            : 1,
          completed: false,
        }))
      : [];

    const newTask = {
      id: uuid(),
      userId: userId as string,
      userid: userId as string,
      listId: resolvedListId,
      name: taskInput.name,
      iterations: taskIterations,
      subtasks: processedSubtasks,
      completed: false,
      collapsed: false,
      isHighPriority: Boolean(taskInput.isHighPriority),
      createdAt: Date.now(),
    };

    await tasks.items.create(newTask);

    // Build response task object
    const responseTask = {
      id: newTask.id,
      name: newTask.name,
      iterations: newTask.iterations,
      isHighPriority: newTask.isHighPriority,
      subtasks: processedSubtasks,
      completed: false,
      createdAt: newTask.createdAt,
    };

    createdTasks.push(responseTask);
    totalSubtasks += processedSubtasks.length;
    totalPomodoros += taskIterations + processedSubtasks.reduce((sum: number, st: any) => sum + st.iterations, 0);
  }

  res.status(201).json({
    listId: resolvedListId,
    listName: resolvedListName,
    listCreated,
    tasksCreated: createdTasks,
    summary: {
      tasksCount: createdTasks.length,
      subtasksCount: totalSubtasks,
      totalPomodorosCreated: totalPomodoros,
    },
  });
}));

app.use("/api", (_req, res) => {
  res.status(404).send("Not found");
});

// Privacy policy page
app.get("/privacy", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host") || "pomo.azurewebsites.net";
  const appUrl = `${proto}://${host}`;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Privacy Policy - Pomodoro Timer</title>
<style>body{font-family:sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.7}h1{margin-bottom:4px}h2{margin-top:2em}small{color:#666}</style>
</head>
<body>
<h1>Privacy Policy</h1>
<small>Last updated: June 2026</small>

<h2>What we collect</h2>
<p>When you log in with Google or Facebook, we store:</p>
<ul>
  <li>Your user ID (provided by the identity provider)</li>
  <li>Your display name (used only to show "Signed in as …")</li>
  <li>The task lists and tasks you create</li>
</ul>
<p>We do <strong>not</strong> store passwords, payment data, or any other personal information.</p>

<h2>How we use your data</h2>
<p>Your data is used solely to save and sync your task lists across devices. We do not sell, share, or use your data for advertising or analytics.</p>

<h2>Third-party login</h2>
<p>We use Google and Facebook OAuth for authentication only. We do not receive or store access tokens — only your user ID and display name are retained.</p>

<h2>Data storage</h2>
<p>Data is stored in Microsoft Azure Cosmos DB in the North Europe region.</p>

<h2>Data deletion</h2>
<p>You can delete your data at any time. See our <a href="${appUrl}/auth/data-deletion">Data Deletion page</a> for instructions.</p>

<h2>Cookies</h2>
<p>We use a session cookie set by Azure App Service Easy Auth to keep you logged in. No tracking or advertising cookies are used.</p>

<h2>Contact</h2>
<p>Questions? Email <a href="mailto:amjo92@gmail.com">amjo92@gmail.com</a>.</p>
</body></html>`);
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
<p>Email <a href="mailto:amjo92@gmail.com">amjo92@gmail.com</a> with subject <strong>Data Deletion Request</strong>. We will delete your data within 30 days and confirm by email.</p>
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
