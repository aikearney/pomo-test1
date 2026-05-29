import { tasks } from "../shared/cosmos";
import { getUserId } from "../shared/auth";

module.exports = async function (context: any, req: any) {
  const method = req.method;
  const taskId = context.bindingData.id;
  const userId = getUserId(req);

  const { resource: task } = await tasks.item(taskId, userId).read();
  if (!task) {
    context.res = { status: 404, body: "Task not found" };
    return;
  }

  if (method === "PATCH") {
    const updates = req.body || {};
    const updated = { ...task, ...updates };

    await tasks.item(taskId, userId).replace(updated);

    context.res = { status: 200, body: updated };
    return;
  }

  if (method === "DELETE") {
    await tasks.item(taskId, userId).delete();
    context.res = { status: 204 };
    return;
  }

  context.res = { status: 405 };
};
