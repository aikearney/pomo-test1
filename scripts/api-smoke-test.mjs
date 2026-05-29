#!/usr/bin/env node

/*
 * Minimal API smoke test for post-deploy verification.
 * - Always checks unauthenticated GET /api/lists contract.
 * - Optionally runs authenticated CRUD checks when a test user header is provided.
 * - Cleans up created resources before exiting.
 */

const baseUrl = normalizeBaseUrl(
  process.env.API_BASE_URL ||
    process.env.SMOKE_BASE_URL ||
    process.env.BASE_URL ||
    "http://localhost:7071",
);

const authHeaderName =
  process.env.API_SMOKE_TEST_HEADER || process.env.TEST_USER_HEADER || "x-ms-client-principal-id";
const authHeaderValue =
  process.env.API_SMOKE_TEST_USER_ID || process.env.TEST_USER_ID || process.env.TEST_USER_HEADER_VALUE || "";
const timeoutMs = Number(process.env.API_SMOKE_TIMEOUT_MS || 15000);

const runAuthChecks = Boolean(authHeaderValue);

const created = {
  listId: undefined,
  taskId: undefined,
};

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Base URL is empty. Set API_BASE_URL.");
  }
  return trimmed.replace(/\/$/, "");
}

function makeUrl(pathname) {
  return `${baseUrl}${pathname}`;
}

function withTimeout(signalTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), signalTimeoutMs);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function request(pathname, options = {}) {
  const { signal, done } = withTimeout(timeoutMs);
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(makeUrl(pathname), {
      ...options,
      headers,
      signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => undefined)
      : await response.text().catch(() => undefined);

    return { response, body };
  } finally {
    done();
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function cleanup(authHeaders) {
  if (!runAuthChecks) {
    return;
  }

  if (created.taskId) {
    const { response } = await request(`/api/tasks/${created.taskId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (response.status !== 204 && response.status !== 404) {
      console.warn(`cleanup warning: task delete returned ${response.status}`);
    }
  }

  if (created.listId) {
    const { response } = await request(`/api/lists/${created.listId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (response.status !== 204 && response.status !== 404) {
      console.warn(`cleanup warning: list delete returned ${response.status}`);
    }
  }
}

async function run() {
  console.log(`api smoke test base URL: ${baseUrl}`);

  const unauth = await request("/api/lists", { method: "GET", headers: {} });
  assert(unauth.response.status === 200, `GET /api/lists expected 200, got ${unauth.response.status}`);
  assert(Array.isArray(unauth.body), "GET /api/lists expected JSON array response");

  const personal = unauth.body.find((item) => item && item.id === "personal");
  assert(personal, "GET /api/lists unauthenticated response missing synthetic personal list");
  console.log("ok: unauthenticated GET /api/lists");

  if (!runAuthChecks) {
    console.log(
      `skip: authenticated checks not run; set ${authHeaderName.toUpperCase().replace(/-/g, "_")} or API_SMOKE_TEST_USER_ID`,
    );
    console.log("smoke test passed (unauthenticated contract only)");
    return;
  }

  const authHeaders = { [authHeaderName]: authHeaderValue };
  const marker = `smoke-${Date.now()}`;

  try {
    const createList = await request("/api/lists", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: `Smoke List ${marker}` }),
    });
    assert(createList.response.status === 201, `POST /api/lists expected 201, got ${createList.response.status}`);
    assert(createList.body && createList.body.id, "POST /api/lists expected list id");
    created.listId = createList.body.id;
    console.log(`ok: created list ${created.listId}`);

    const patchList = await request(`/api/lists/${created.listId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ name: `Smoke List ${marker} Updated`, pinned: true }),
    });
    assert(patchList.response.status === 200, `PATCH /api/lists/:id expected 200, got ${patchList.response.status}`);
    console.log("ok: updated list");

    const createTask = await request(`/api/lists/${created.listId}/tasks`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: `Smoke Task ${marker}`, iterations: 1 }),
    });
    assert(createTask.response.status === 201, `POST /api/lists/:id/tasks expected 201, got ${createTask.response.status}`);
    assert(createTask.body && createTask.body.id, "POST /api/lists/:id/tasks expected task id");
    created.taskId = createTask.body.id;
    console.log(`ok: created task ${created.taskId}`);

    const listTasks = await request(`/api/lists/${created.listId}/tasks`, {
      method: "GET",
      headers: authHeaders,
    });
    assert(listTasks.response.status === 200, `GET /api/lists/:id/tasks expected 200, got ${listTasks.response.status}`);
    assert(Array.isArray(listTasks.body), "GET /api/lists/:id/tasks expected JSON array response");
    assert(
      listTasks.body.some((task) => task && task.id === created.taskId),
      "GET /api/lists/:id/tasks did not include created task",
    );
    console.log("ok: listed tasks");

    const patchTask = await request(`/api/tasks/${created.taskId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ completed: true }),
    });
    assert(patchTask.response.status === 200, `PATCH /api/tasks/:id expected 200, got ${patchTask.response.status}`);
    console.log("ok: updated task");

    const deleteTask = await request(`/api/tasks/${created.taskId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert(deleteTask.response.status === 204, `DELETE /api/tasks/:id expected 204, got ${deleteTask.response.status}`);
    created.taskId = undefined;
    console.log("ok: deleted task");

    const deleteList = await request(`/api/lists/${created.listId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert(deleteList.response.status === 204, `DELETE /api/lists/:id expected 204, got ${deleteList.response.status}`);
    created.listId = undefined;
    console.log("ok: deleted list");

    console.log("smoke test passed (unauthenticated + authenticated CRUD checks)");
  } finally {
    await cleanup(authHeaders);
  }
}

run().catch((error) => {
  console.error(`smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
