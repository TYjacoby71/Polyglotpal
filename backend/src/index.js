import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';

import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { conversationRoutes } from './routes/conversation.js';
import { notificationRoutes } from './routes/notifications.js';
import { userRoutes } from './routes/users.js';
import { db } from './db/client.js';
import { redisClient } from './db/redis.js';

const app = Fastify({ logger: true });

// ── Plugins ────────────────────────────────────────────────────────
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod' });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB audio

// ── Auth decorator ─────────────────────────────────────────────────
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// ── Routes ─────────────────────────────────────────────────────────
await app.register(authRoutes,         { prefix: '/auth' });
await app.register(userRoutes,         { prefix: '/users' });
await app.register(sessionRoutes,      { prefix: '/sessions' });
await app.register(conversationRoutes, { prefix: '/conversation' });
await app.register(notificationRoutes, { prefix: '/notifications' });

// ── Health check ───────────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  ts: new Date().toISOString(),
  db: 'connected',
}));

// ── Start ──────────────────────────────────────────────────────────
try {
  await db.connect();
  await redisClient.connect();
  app.log.info('DB + Redis connected');
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
