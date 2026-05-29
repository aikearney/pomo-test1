import { Container, CosmosClient, Database } from "@azure/cosmos";

const DEFAULT_DATABASE_ID = "tasks-db";
const DEFAULT_LISTS_CONTAINER_ID = "lists";
const DEFAULT_TASKS_CONTAINER_ID = "tasks";

let client: CosmosClient | undefined;
let database: Database | undefined;

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
		client = new CosmosClient(
			getRequiredSetting("COSMOS_CONNECTION_STRING", "CUSTOMCONNSTR_COSMOS_CONNECTION_STRING", "COSMOSDB_CONNECTION_STRING"),
		);
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
