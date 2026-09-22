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
    throw new Error(`No se pudo conectar a MongoDB. ¿Has ejecutado \`docker compose up\`? (${cause})`);
  }

  return { client, db: client.db() };
}
