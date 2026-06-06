"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.connectRedis = connectRedis;
const redis_1 = require("redis");
let redisClient = null;
let useInMemory = false;
const inMemoryCache = new Map();
async function connectRedis() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = (0, redis_1.createClient)({ url: redisUrl });
    redisClient.on('error', (err) => {
        console.warn('Redis error occurred, falling back to In-Memory Cache:', err.message);
        useInMemory = true;
    });
    try {
        await redisClient.connect();
        console.log('Redis connected successfully');
    }
    catch (error) {
        console.warn('Could not connect to Redis. Using In-Memory fallback cache.');
        useInMemory = true;
    }
}
exports.cache = {
    async get(key) {
        if (useInMemory || !redisClient) {
            const entry = inMemoryCache.get(key);
            if (!entry)
                return null;
            if (Date.now() > entry.expiresAt) {
                inMemoryCache.delete(key);
                return null;
            }
            return entry.value;
        }
        try {
            return await redisClient.get(key);
        }
        catch {
            return null;
        }
    },
    async set(key, value, ttlSeconds) {
        if (useInMemory || !redisClient) {
            inMemoryCache.set(key, {
                value,
                expiresAt: Date.now() + ttlSeconds * 1000,
            });
            return;
        }
        try {
            await redisClient.set(key, value, { EX: ttlSeconds });
        }
        catch (err) {
            console.warn('Failed to set key in Redis, using In-Memory Cache instead.');
            inMemoryCache.set(key, {
                value,
                expiresAt: Date.now() + ttlSeconds * 1000,
            });
        }
    },
    async del(key) {
        if (useInMemory || !redisClient) {
            inMemoryCache.delete(key);
            return;
        }
        try {
            await redisClient.del(key);
        }
        catch {
            inMemoryCache.delete(key);
        }
    }
};
