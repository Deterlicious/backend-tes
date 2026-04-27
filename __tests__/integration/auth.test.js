const request = require("supertest");
const app = require("../../app");
const Akun = require("../../models/akunModel"); // WAJIB diimpor untuk pembersihan

describe("Auth — Registrasi & Login", () => {
  // PEMBERSIHAN MUTLAK: Cegah email bentrok antar skenario
  beforeEach(async () => {
    await Akun.deleteMany({});
  });

  // Skenario A: Registrasi berhasil
  test("POST /api/akun/auth/register — berhasil buat akun baru", async () => {
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    expect(res.statusCode).toBe(201);
    // FIX: Tambahkan titik (.) sesuai format dari akunController.js
    expect(res.body.message).toBe("Registrasi berhasil.");
    expect(res.body.data).toHaveProperty("email", "owner@kafemurah.com");
    expect(res.body.data).not.toHaveProperty("password");
  });

  // Skenario B: Email duplikat harus ditolak
  test("POST /api/akun/auth/register — email duplikat harus ditolak", async () => {
    // Register tahap 1 (berhasil karena DB baru dibersihkan)
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    // Register tahap 2 dengan email yang sama persis
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "PasswordLain456!",
      username: "user_duplikat",
    });

    // Sesuaikan status code dengan error handler Anda (bisa 400 atau 409)
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // Skenario C: Login berhasil dapat token
  test("POST /api/akun/auth/login — berhasil dapat accessToken", async () => {
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    const res = await request(app).post("/api/akun/auth/login").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      // FIX: deviceID TIDAK BOLEH DIKIRIM LAGI. Sesuai arsitektur baru.
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("email", "owner@kafemurah.com");
  });

  // Skenario D (DIUBAH): Menguji penolakan akses karena password salah
  test("POST /api/akun/auth/login — password salah harus ditolak", async () => {
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

    const res = await request(app).post("/api/akun/auth/login").send({
      email: "owner@kafemurah.com",
      password: "PasswordSalah999!", // Password salah
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  // Skenario E: Penolakan Email Sekali Pakai (Disposable Email)
  test("POST /api/akun/auth/register — email disposable harus ditolak", async () => {
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "hacker@mailinator.com", // mailinator ada di daftar blokir
      password: "PasswordAman123!",
      username: "spammer",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/disposable/i);
  });

  // Skenario F: Validasi Kekuatan Password
  test("POST /api/akun/auth/register — password lemah (tanpa angka/huruf besar) harus ditolak", async () => {
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "validowner@kafemurah.com",
      password: "passwordlemah", // Tidak ada huruf besar dan angka
      username: "owner_lemah",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/huruf kapital/i);
  });

  // Skenario G: Pengujian Input Kosong pada Login
  test("POST /api/akun/auth/login — input kosong harus ditolak", async () => {
    const res = await request(app).post("/api/akun/auth/login").send({
      email: "",
      password: "",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/wajib diisi/i);
  });

  // Skenario H: Pengujian Refresh Token Sesi Akun
  test("POST /api/akun/auth/refreshtoken — berhasil mendapat token baru", async () => {
    // 1. Register
    await request(app).post("/api/akun/auth/register").send({
      email: "owner_refresh@kafemurah.com",
      password: "Password123!",
      username: "owner_refresh",
    });

    // 2. Login untuk mendapatkan cookies
    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner_refresh@kafemurah.com",
      password: "Password123!",
    });

    // Ambil cookie dari response headers
    const cookies = loginRes.headers["set-cookie"];

    // 3. Panggil endpoint refresh token dengan menyertakan cookie
    const refreshRes = await request(app)
      .post("/api/akun/auth/refreshtoken")
      .set("Cookie", cookies);

    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.body).toHaveProperty("accessToken");
    expect(refreshRes.body.message).toMatch(/berhasil diperbarui/i);
  });

  // Skenario I: Pengujian Logout (Penghapusan Cookie Sesi)
  test("POST /api/akun/auth/logout — berhasil menghapus cookie sesi", async () => {
    await request(app).post("/api/akun/auth/register").send({
      email: "owner_logout@kafemurah.com",
      password: "Password123!",
      username: "owner_logout",
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner_logout@kafemurah.com",
      password: "Password123!",
    });

    const cookies = loginRes.headers["set-cookie"];

    const logoutRes = await request(app)
      .post("/api/akun/auth/logout")
      .set("Cookie", cookies);

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.body.message).toBe("Logout berhasil.");

    // Pastikan header set-cookie menginstruksikan penghapusan (Max-Age=0 atau kedaluwarsa di masa lalu)
    const logoutCookies = logoutRes.headers["set-cookie"];
    expect(logoutCookies[0]).toMatch(/Max-Age=0/i);
  });

  // Skenario J: Penolakan Email yang Tidak Terdaftar (Cegah Enumerasi)
  test("POST /api/akun/auth/login — email tidak terdaftar harus ditolak", async () => {
    const res = await request(app).post("/api/akun/auth/login").send({
      email: "emailhantu@domainkosong.com",
      password: "Password123!",
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400); // Bisa 401 atau 404
  });

  // Skenario K: Validasi Format Email Rusak
  test("POST /api/akun/auth/register — format email rusak sama sekali harus ditolak", async () => {
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "bukan-format-email-yang-benar",
      password: "PasswordAman123!",
      username: "tester_email",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/format email/i);
  });

  // Skenario L: Keamanan Endpoint Refresh Token (Tanpa Token)
  test("POST /api/akun/auth/refreshtoken — akses tanpa cookie harus ditolak (401)", async () => {
    const res = await request(app).post("/api/akun/auth/refreshtoken");
    
    // Harus ditolak karena tidak ada token yang dilampirkan
    expect(res.statusCode).toBe(401); 
  });

  // Skenario M: Keamanan Endpoint Refresh Token (Token Palsu/Dimanipulasi)
  test("POST /api/akun/auth/refreshtoken — token palsu/dimanipulasi harus ditolak", async () => {
    const res = await request(app)
      .post("/api/akun/auth/refreshtoken")
      .set("Cookie", ["refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.palsu.ngawur"]);

    // Harus gagal verifikasi JWT
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
  });
});
