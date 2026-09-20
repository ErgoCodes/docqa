import { buildServer } from './server.js';

const app = buildServer();

const port = Number(process.env.API_PORT ?? 3000);
const host = process.env.API_HOST ?? '0.0.0.0';

app
  .listen({ port, host })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
