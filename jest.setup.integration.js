// jest.setup.integration.js
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  // Tutup koneksi MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Stop Mongo Memory Server
  if (mongod) {
    await mongod.stop();
  }

  // Tutup koneksi Redis jika masih aktif
  try {
    const redis = require("./config/redis");

    if (redis && redis.status !== "end") {
      redis.disconnect();
    }
  } catch (err) {
    // abaikan error shutdown redis saat testing
  }
});

// ← tidak ada afterEach, data bertahan selama satu test suite berjalan