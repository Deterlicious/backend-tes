const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger");

const server = http.createServer(app);

async function connectDB() {
  await mongoose.connect(config.MONGO_URI);
  logger.info("✅ Terhubung ke MongoDB");
}

async function start() {
  try {
    await connectDB();
    server.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 Server running on http://${config.HOST}:${config.PORT}`);
    });
  } catch (err) {
    logger.error("Fatal start error", err);
    process.exit(1);
  }
}

// graceful shutdown
process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  server.close(async () => {
    await mongoose.disconnect();
    logger.info("Closed.");
    process.exit(0);
  });
});

start();
