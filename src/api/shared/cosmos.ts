import { Container, CosmosClient, Database } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const DEFAULT_DATABASE_ID = "tasks-db";
const DEFAULT_LISTS_CONTAINER_ID = "lists";
const DEFAULT_TASKS_CONTAINER_ID = "tasks";
const DEFAULT_USER_PREFERENCES_CONTAINER_ID = "user-preferences";

let client: CosmosClient | undefined;
let database: Database | undefined;

function findSetting(...names: string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name];
		if (value) {
			return value;
		}
	}

	return undefined;
}

function getRequiredSetting(...names: string[]): string {
	for (const name of names) {
		const value = process.env[name];
		if (value) {
			return value;
		}
	}

	throw new Error(`Missing required setting. Configure one of: ${names.join(", ")}`);
}

function getOptionalSetting(defaultValue: string, ...names: string[]): string {
	for (const name of names) {
		const value = process.env[name];
		if (value) {
			return value;
		}
	}

	return defaultValue;
}

function getClient(): CosmosClient {
	if (!client) {
		const authMode = getOptionalSetting("connection-string", "COSMOS_AUTH_MODE").toLowerCase();

		if (authMode === "managed-identity" || authMode === "aad") {
			const endpoint = getRequiredSetting("COSMOS_ENDPOINT", "COSMOS_ACCOUNT_ENDPOINT");
			const credential = new DefaultAzureCredential();

			client = new CosmosClient({
				endpoint,
				aadCredentials: credential,
			});
		} else {
			const connectionString = findSetting(
				"COSMOS_CONNECTION_STRING",
				"CUSTOMCONNSTR_COSMOS_CONNECTION_STRING",
				"COSMOSDB_CONNECTION_STRING",
			);

			if (!connectionString) {
				throw new Error(
					"Missing required Cosmos auth settings. Configure COSMOS_AUTH_MODE=managed-identity with COSMOS_ENDPOINT, or set COSMOS_CONNECTION_STRING.",
				);
			}

			client = new CosmosClient(connectionString);
		}
	}

	return client;
}

function getDatabase(): Database {
	if (!database) {
		database = getClient().database(
			getOptionalSetting(DEFAULT_DATABASE_ID, "COSMOS_DATABASE_ID", "COSMOS_DB_NAME"),
		);
	}

	return database;
}

export function getListsContainer(): Container {
	return getDatabase().container(
		getOptionalSetting(DEFAULT_LISTS_CONTAINER_ID, "COSMOS_LISTS_CONTAINER_ID", "COSMOS_LISTS_CONTAINER_NAME"),
	);
}

export function getTasksContainer(): Container {
	return getDatabase().container(
		getOptionalSetting(DEFAULT_TASKS_CONTAINER_ID, "COSMOS_TASKS_CONTAINER_ID", "COSMOS_TASKS_CONTAINER_NAME"),
	);
}

export function getUserPreferencesContainer(): Container {
	return getDatabase().container(
		getOptionalSetting(
			DEFAULT_USER_PREFERENCES_CONTAINER_ID,
			"COSMOS_USER_PREFERENCES_CONTAINER_ID",
			"COSMOS_USER_PREFERENCES_CONTAINER_NAME",
		),
	);
}

/**
 * Result type for batch task creation operations.
 */
export interface BatchCreateResult {
	success: boolean;
	taskIds?: string[];
	error?: string;
	rollbackDetails?: string;
}

/**
 * Atomic batch task creation using Cosmos transactional batch.
 * Validates all tasks before creating any. On Cosmos error, transaction fails atomically.
 * 
 * @param userId - Owner user ID
 * @param tasks - Tasks to create (validated structure)
 * @param listId - Target list ID
 * @returns Result with taskIds if success, error message if failed
 */
export async function createTasksBatch(
	userId: string,
	tasks: any[],
	listId: string,
): Promise<BatchCreateResult> {
	try {
		const container = getTasksContainer();
		const createdTaskIds: string[] = [];
		const now = Date.now();

		// Prepare all task documents for batch creation
		const taskDocs = tasks.map((task: any) => {
			const taskId = Math.random().toString(36).substring(2, 11); // Quick UUID-like ID
			createdTaskIds.push(taskId);

			// Process subtasks
			const subtasks = Array.isArray(task.subtasks)
				? task.subtasks.map((subtask: any) => ({
						id: Math.random().toString(36).substring(2, 11),
						name: subtask.name,
						iterations: Number.isFinite(Number(subtask.iterations)) && Number(subtask.iterations) > 0
							? Math.floor(Number(subtask.iterations))
							: 1,
						completed: false,
					}))
				: [];

			const iterations = Number.isFinite(Number(task.iterations)) && Number(task.iterations) > 0
				? Math.floor(Number(task.iterations))
				: 1;

			return {
				id: taskId,
				userId,
				userid: userId,
				listId,
				name: task.name,
				iterations,
				subtasks,
				completed: false,
				collapsed: false,
				isHighPriority: task.isHighPriority === true,
				createdAt: now,
			};
		});

		// Batch size limit: 100 items per transaction
		if (taskDocs.length > 100) {
			console.error(`[COSMOS] Batch size ${taskDocs.length} exceeds transactional limit (100)`);
			return {
				success: false,
				error: "BATCH_SIZE_EXCEEDED",
				rollbackDetails: `Cannot create ${taskDocs.length} tasks in single transaction (max 100)`,
			};
		}

		// Create batch operations (Cosmos expects array of operations with method + resource)
		const batchOps = taskDocs.map((taskDoc) => ({
			operationType: "Create" as const,
			resourceBody: taskDoc,
		}));

		// Execute batch (atomic — all or nothing)
		const batchResponse = await container.items.batch(batchOps, userId);

		// Check if batch was successful (status 200-299)
		if ((batchResponse.code ?? 500) >= 400) {
			console.error(
				`[COSMOS] Batch creation failed with code ${batchResponse.code}`,
			);
			return {
				success: false,
				error: "TRANSACTION_FAILED",
				rollbackDetails: `Cosmos batch failed with status ${batchResponse.code}. All tasks rolled back.`,
			};
		}

		console.log(
			`[COSMOS] Successfully created ${taskDocs.length} tasks in atomic batch for listId=${listId}, userId=${userId}`,
		);

		return {
			success: true,
			taskIds: createdTaskIds,
		};
	} catch (error: any) {
		console.error("[COSMOS] Unexpected error during batch creation:", error.message);
		return {
			success: false,
			error: "TRANSACTION_FAILED",
			rollbackDetails: `Unexpected error: ${error.message}. Transaction rolled back.`,
		};
	}
}
