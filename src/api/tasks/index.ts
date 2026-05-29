import { v4 as uuid } from "uuid";
import { getTasksContainer } from "../shared/cosmos";
import { getUserId } from "../shared/auth";

module.exports = async function (context: any, req: any) {
  const method = req.method;
  const userId = getUserId(req);
  if (!userId) {
    context.res = { status: 401, body: "Authentication required" };
    return;
  }

  const tasks = getTasksContainer();

  if (method === "GET") {
    const query = `SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC`;
    const { resources } = await tasks.items
      .query({ query, parameters: [{ name: "@userId", value: userId }] })
      .fetchAll();

    context.res = { status: 200, body: resources };
    return;
  }

  if (method === "POST") {
    const body = req.body || {};
    const taskName = body.name ?? body.title;
    if (!taskName) {
      context.res = { status: 400, body: "Missing task name" };
      return;
    }

    const newTask = {
      id: uuid(),
      userId,
      name: taskName,
      createdAt: Date.now(),
      completed: false
    };

    await tasks.items.create(newTask);

    context.res = { status: 201, body: newTask };
    return;
  }

  if (method === "DELETE") {
    const id = req.query.id;
    if (!id) {
      context.res = { status: 400, body: "Missing id" };
      return;
    }

    await tasks.item(id, userId).delete();
    context.res = { status: 204 };
    return;
  }

  context.res = { status: 405 };
};
