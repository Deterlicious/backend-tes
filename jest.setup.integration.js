// jest.setup.integration.js
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();

  const redis = require("./config/redis"); // sesuaikan path
  await redis.quit();
});

// ← tidak ada afterEach, data bertahan selama satu test suite berjalan