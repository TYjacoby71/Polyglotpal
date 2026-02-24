import { createClient } from 'redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

redisClient.on('error', err => console.error('Redis error:', err));

export async function cacheGet(key) {
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch { /* non-fatal */ }
}

export async function cacheDel(key) {
  try { await redisClient.del(key); } catch { /* non-fatal */ }
}
