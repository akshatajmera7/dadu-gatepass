import { createClient } from 'redis';

type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;
let useInMemory = true;
const inMemoryCache = new Map<string, { value: string; expiresAt: number }>();

export async function connectRedis() {
  console.log('Using In-Memory Cache for temporary key storage (Redis bypassed).');
}

export const cache = {
  async get(key: string): Promise<string | null> {
    if (useInMemory || !redisClient) {
      const entry = inMemoryCache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        inMemoryCache.delete(key);
        return null;
      }
      return entry.value;
    }
    try {
      return await redisClient.get(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (useInMemory || !redisClient) {
      inMemoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return;
    }
    try {
      await redisClient.set(key, value, { EX: ttlSeconds });
    } catch (err) {
      console.warn('Failed to set key in Redis, using In-Memory Cache instead.');
      inMemoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  },

  async del(key: string): Promise<void> {
    if (useInMemory || !redisClient) {
      inMemoryCache.delete(key);
      return;
    }
    try {
      await redisClient.del(key);
    } catch {
      inMemoryCache.delete(key);
    }
  }
};
