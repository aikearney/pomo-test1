import { v4 as uuid } from "uuid";
import { getListsContainer } from "../shared/cosmos";
import { getUserId } from "../shared/auth";

function mapStorageError(error: unknown): { status: number; body: { error: string; details?: string } } {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Missing required setting") ||
    message.includes("Missing required Cosmos auth settings")
  ) {
    return {
      status: 503,
      body: {
        error: "Storage backend is not configured",
        details: message,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Failed to load lists",
    },
  };
}

module.exports = async function (context: any, req: any) {
  const method = req.method;
  const userId = getUserId(req);

  if (method === "GET") {
    if (!userId) {
      // Return a synthetic Personal list for anonymous users
      context.res = {
        status: 200,
        body: [
          {
            id: "personal",
            name: "Personal",
            createdAt: 0,
            color: null,
            order: 0,
            pinned: false,
            isLocal: true
          }
        ]
      };
      return;
    }

    try {
      const lists = getListsContainer();
      const query = `SELECT * FROM c WHERE c.userId = @userId ORDER BY c.order ASC`;
      const { resources } = await lists.items
        .query({ query, parameters: [{ name: "@userId", value: userId }] })
        .fetchAll();

      context.res = { status: 200, body: resources };
    } catch (error) {
      context.log.error("GET /api/lists failed", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
      context.res = mapStorageError(error);
    }
    return;
  }

  if (method === "POST") {
    if (!userId) {
      context.res = { status: 401, body: "Authentication required" };
      return;
    }

    const body = req.body || {};
    if (!body.name) {
      context.res = { status: 400, body: "Missing list name" };
      return;
    }

    try {
      const lists = getListsContainer();

      const newList = {
        id: uuid(),
        userId,
        name: body.name,
        createdAt: Date.now(),
        color: body.color || null,
        order: body.order ?? Date.now(),
        pinned: body.pinned ?? false,
      };

      await lists.items.create(newList);

      context.res = { status: 201, body: newList };
    } catch (error) {
      context.log.error("POST /api/lists failed", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
      context.res = mapStorageError(error);
    }
    return;
  }

  context.res = { status: 405 };
};
