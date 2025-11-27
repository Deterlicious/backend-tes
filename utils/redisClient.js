const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  password: process.env.REDIS_PASSWORD || null,
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

redisClient.connect();

module.exports = redisClient;