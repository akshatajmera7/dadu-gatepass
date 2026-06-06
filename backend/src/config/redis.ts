import { createClient } from 'redis';

type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;
let useInMemory = false;
const inMemoryCache = new Map<string, { value: string; expiresAt: number }>();

export async function connectRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) => {
        if (retries > 2) return new Error('Max Redis reconnect attempts exceeded');
        return 1000;
      }
    }
  });

  redisClient.on('error', (err) => {
    if (!useInMemory) {
      console.warn('Redis connection failed, falling back to In-Memory Cache.');
      useInMemory = true;
    }
  });

  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (error: any) {
    if (!useInMemory) {
      console.warn('Could not connect to Redis. Using In-Memory fallback cache.');
      useInMemory = true;
    }
  }
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
