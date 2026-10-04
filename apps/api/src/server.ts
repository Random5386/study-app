// Entry point: builds the app and starts listening for HTTP requests.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { startJobWorker, stopJobWorker } from './jobs/queue.js';
import { logger } from './lib/logger.js';

const app = createApp();
await startJobWorker(); // background jobs (docs/10-background-jobs.md)

const server = app.listen(env.PORT, () => {
  logger.info(`${env.APP_NAME} API listening on http://localhost:${env.PORT}`);
});

// Close connections cleanly when stopped (Ctrl+C, or a host restarting the app).
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await stopJobWorker();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
