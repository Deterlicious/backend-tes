require('dotenv').config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger");

// Tuan, pastikan untuk mengimpor instance Redis Anda di sini
// (Sesuaikan path-nya dengan struktur folder Anda)
const redis = require("./utils/redisClient"); // Contoh path

const server = http.createServer(app);
const startDeviceCleanupJob = require("./jobs/deviceCleanup");

async function connectDB() {
  await mongoose.connect(config.MONGO_URI);
  logger.info("Terhubung ke MongoDB");
  
  // Memulai cron job pembersihan perangkat pending
  startDeviceCleanupJob();
}

async function start() {
  try {
    await connectDB();
    server.listen(config.PORT, config.HOST, () => {
      logger.info(`Server running on http://${config.HOST}:${config.PORT}`);
    });
  } catch (err) {
    logger.error("Fatal start error", err);
    process.exit(1);
  }
}

// Fungsi terpusat untuk Graceful Shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  // Berhenti menerima request baru
  server.close(async () => {
    try {
      // 1. Putuskan MongoDB
      await mongoose.disconnect();
      logger.info("MongoDB disconnected.");

      // 2. Putuskan Redis (Mencegah koneksi menggantung)
      if (redis && typeof redis.quit === "function") {
        await redis.quit();
        logger.info("Redis disconnected.");
      }

      logger.info("Server closed successfully.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful shutdown", err);
      process.exit(1);
    }
  });
};

// Menangkap sinyal dari Ctrl+C (Terminal Lokal)
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Menangkap sinyal dari PM2 / systemd / Docker (Production)
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

start();