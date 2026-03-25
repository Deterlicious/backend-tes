const request = require("supertest");
const app = require("../../app");

describe("Auth — Registrasi & Login", () => {
  // Skenario A: Registrasi berhasil
  test("POST /api/akun/auth/register — berhasil buat akun baru", async () => {
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Registrasi berhasil");
    expect(res.body.data).toHaveProperty("email", "owner@kafemurah.com");
    expect(res.body.data).not.toHaveProperty("password");
  });

  // Skenario B: Email duplikat harus gagal
  test("POST /api/akun/auth/register — email duplikat harus 400", async () => {
    // Register pertama
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    // Register kedua dengan email sama
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "PasswordLain456!",
      username: "user_duplikat",
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/sudah terdaftar/i);
  });

  // Skenario C: Login berhasil dapat token
  test("POST /api/akun/auth/login — berhasil dapat accessToken", async () => {
    // Tahap 1: Register
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    // Tahap 2: Login
    const res = await request(app).post("/api/akun/auth/login").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      deviceID: "device-laptop-001",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("email", "owner@kafemurah.com");
  });

  // Skenario D: Login tanpa deviceID harus ditolak
  test("POST /api/akun/auth/login — tanpa deviceID harus 400", async () => {
    const res = await request(app).post("/api/akun/auth/login").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      // deviceID sengaja tidak dikirim
    });

    expect(res.statusCode).toBe(400);
  });
});
