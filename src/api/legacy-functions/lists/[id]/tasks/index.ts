import { v4 as uuid } from "uuid";
import { getListsContainer, getTasksContainer } from "../../../shared/cosmos";
import { getUserId } from "../../../shared/auth";

module.exports = async function (context: any, req: any) {
  const method = req.method;
  const listId = context.bindingData.id;
  const userId = getUserId(req);
  if (!userId) {
    context.res = { status: 401, body: "Authentication required" };
    return;
  }

  const lists = getListsContainer();
  const tasks = getTasksContainer();

  // Ensure list exists
  const { resource: list } = await lists.item(listId, userId).read();
  if (!list) {
    context.res = { status: 404, body: "List not found" };
    return;
  }

  if (method === "GET") {
    const query = `SELECT * FROM c WHERE c.userId = @userId AND c.listId = @listId ORDER BY c.createdAt ASC`;
    const { resources } = await tasks.items
      .query({
        query,
        parameters: [
          { name: "@userId", value: userId },
          { name: "@listId", value: listId },
        ],
      })
      .fetchAll();

    context.res = { status: 200, body: resources };
    return;
  }

  if (method === "POST") {
    const body = req.body || {};
    if (!body.name) {
      context.res = { status: 400, body: "Missing task name" };
      return;
    }

    const newTask = {
      id: uuid(),
      userId,
      listId,
      name: body.name,
      iterations: body.iterations ?? 1,
      subtasks: body.subtasks ?? [],
      completed: false,
      collapsed: false,
      isHighPriority: body.isHighPriority ?? false,
      createdAt: Date.now(),
    };

    await tasks.items.create(newTask);

    context.res = { status: 201, body: newTask };
    return;
  }

  context.res = { status: 405 };
};
