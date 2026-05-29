// jest.setup.integration.js
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let replset;

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri());
});

afterAll(async () => {
  // Tutup koneksi MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Stop Mongo Memory Server
  if (replset) {
    await replset.stop();
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