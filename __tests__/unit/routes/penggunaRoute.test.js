const request = require("supertest");
const mongoose = require("mongoose");

// 1. MOCKING AUTH AKUN
jest.mock("../../../middleware/authAkun", () => {
  return (req, res, next) => {
    req.akun = { tenantID: "mock-tenant-id-123" }; 
    next();
  };
});

// 2. MOCKING REDIS (Menghilangkan warning Open Handles)
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}));

const app = require("../../../app"); 

describe("Integration Test — Route /api/pengguna/pin-login", () => {
  
  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test("Mencegat dan merespons 400 jika payload login kosong", async () => {
    const res = await request(app).post("/api/pengguna/pin-login").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Data login kosong/i);
  });

  test("Mencegat dan merespons 400 jika mencoba NoSQL Injection", async () => {
    const res = await request(app).post("/api/pengguna/pin-login").send({
      nama: { $ne: null },
      pin: "123456",
      deviceID: "DEV-MAC-001"
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Format nama tidak valid/i);
  });

  test("Mencegat dan merespons 400 jika nama hanya berisi spasi", async () => {
    const res = await request(app).post("/api/pengguna/pin-login").send({
      nama: "    ", 
      pin: "123456",
      deviceID: "DEV-MAC-001"
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Nama pengguna wajib diisi/i);
  });
});