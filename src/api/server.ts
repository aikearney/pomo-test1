import express, { type Request } from "express";
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

function getAuthenticatedUserId(req: Request): string | undefined {
  return getUserId({ headers: req.headers });
}

app.get("/api/lists", async (req, res) => {
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
});

app.post("/api/lists", async (req, res) => {
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
    userId,
    name: req.body.name,
    createdAt: Date.now(),
    color: req.body.color ?? null,
    order: req.body.order ?? Date.now(),
    pinned: req.body.pinned ?? false,
  };

  await getListsContainer().items.create(newList);
  res.status(201).json(newList);
});

app.patch("/api/lists/:id", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id;
  const lists = getListsContainer();
  const { resource: list } = await lists.item(listId, userId).read();

  if (!list) {
    res.status(404).send("List not found");
    return;
  }

  const updated = { ...list, ...(req.body ?? {}) };
  await lists.item(listId, userId).replace(updated);
  res.status(200).json(updated);
});

app.delete("/api/lists/:id", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id;
  const lists = getListsContainer();
  const tasks = getTasksContainer();

  const { resource: list } = await lists.item(listId, userId).read();
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

  await Promise.all(resources.map((task) => tasks.item(task.id, userId).delete()));
  await lists.item(listId, userId).delete();

  res.status(204).send();
});

app.get("/api/lists/:id/tasks", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id;
  const lists = getListsContainer();
  const tasks = getTasksContainer();

  const { resource: list } = await lists.item(listId, userId).read();
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
});

app.post("/api/lists/:id/tasks", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const listId = req.params.id;
  const lists = getListsContainer();

  const { resource: list } = await lists.item(listId, userId).read();
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
    userId,
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
});

app.patch("/api/tasks/:id", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const taskId = req.params.id;
  const tasks = getTasksContainer();
  const { resource: task } = await tasks.item(taskId, userId).read();

  if (!task) {
    res.status(404).send("Task not found");
    return;
  }

  const updated = { ...task, ...(req.body ?? {}) };
  await tasks.item(taskId, userId).replace(updated);
  res.status(200).json(updated);
});

app.delete("/api/tasks/:id", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).send("Authentication required");
    return;
  }

  const taskId = req.params.id;
  const tasks = getTasksContainer();
  const { resource: task } = await tasks.item(taskId, userId).read();

  if (!task) {
    res.status(404).send("Task not found");
    return;
  }

  await tasks.item(taskId, userId).delete();
  res.status(204).send();
});

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
