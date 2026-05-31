import { Container, CosmosClient, Database } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const DEFAULT_DATABASE_ID = "tasks-db";
const DEFAULT_LISTS_CONTAINER_ID = "lists";
const DEFAULT_TASKS_CONTAINER_ID = "tasks";

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
