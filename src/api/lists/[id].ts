import { lists, tasks } from "../shared/cosmos";
import { getUserId } from "../shared/auth";

module.exports = async function (context: any, req: any) {
  const method = req.method;
  const listId = context.bindingData.id;
  const userId = getUserId(req);

  // Fetch list
  const { resource: list } = await lists.item(listId, userId).read();
  if (!list) {
    context.res = { status: 404, body: "List not found" };
    return;
  }

  if (method === "PATCH") {
    const updates = req.body || {};
    const updated = { ...list, ...updates };

    await lists.item(listId, userId).replace(updated);

    context.res = { status: 200, body: updated };
    return;
  }

  if (method === "DELETE") {
    // Delete tasks belonging to this list
    const query = `SELECT * FROM c WHERE c.userId = @userId AND c.listId = @listId`;
    const { resources } = await tasks.items
      .query({
        query,
        parameters: [
          { name: "@userId", value: userId },
          { name: "@listId", value: listId },
        ],
      })
      .fetchAll();

    for (const t of resources) {
      await tasks.item(t.id, userId).delete();
    }

    await lists.item(listId, userId).delete();

    context.res = { status: 204 };
    return;
  }

  context.res = { status: 405 };
};
