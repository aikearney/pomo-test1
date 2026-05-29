import { CosmosClient } from "@azure/cosmos";

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING!);

export const db = client.database("tasks-db");
export const lists = db.container("lists");
export const tasks = db.container("tasks");
