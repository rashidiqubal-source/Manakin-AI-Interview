import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { setupSockets } from './sockets';
import { startKeepAlive } from './utils/keepAlive';

import { inferenceService } from './ml/services/inferenceService';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 10000,
});

setupSockets(io);

const PORT = env.PORT;

server.listen(PORT, async () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${PORT}`);
  startKeepAlive();
  
  // Initialize YOLO26 vision models once on startup (unconditionally)
  inferenceService.initialize().catch((mlErr) => {
    logger.error(`[YOLO26] Background model preload warning: ${mlErr.message}`);
  });

  try {
    await prisma.$connect();
    logger.info('📦 Connected to PostgreSQL DB via Prisma');
  } catch (error: any) {
    logger.warn(`Database connection might be delayed: ${error.message}. Prisma will lazily connect on next request.`);
  }
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received signal to terminate: ${signal}`);
  
  await inferenceService.shutdown();
  server.close(async () => {
    logger.info('HTTP server closed');
    await prisma.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (err: any) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`);
  gracefulShutdown('unhandledRejection');
});
