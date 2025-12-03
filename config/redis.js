const Redis = require("ioredis");
const logger = require("../utils/logger");

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 1,
});

redis.on("connect", () => logger.info("🔌 Redis connected"));
redis.on("error", (err) => logger.error("Redis error:", err));

module.exports = redis;
