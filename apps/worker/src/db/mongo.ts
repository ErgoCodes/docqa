import { MongoClient, type Db } from 'mongodb';

export interface MongoConnection {
  client: MongoClient;
  db: Db;
}

export async function connectMongo(uri: string): Promise<MongoConnection> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
  } catch (error: unknown) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not connect to MongoDB. Have you run \`docker compose up\`? (${cause})`);
  }

  return { client, db: client.db() };
}
