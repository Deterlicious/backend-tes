const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const Permission = require("../../models/permissionModel");
const SesiBooking = require("../../models/sesiBookingModel");
const Penjualan = require("../../models/penjualanModel");
const Pelanggan = require("../../models/pelangganModel");
const TipeAset = require("../../models/tipeAsetModel");
const Aset = require("../../models/asetModel");
const Tarif = require("../../models/tarifModel");
const Pajak = require("../../models/pajakModel");
const ProdukPajak = require("../../models/produkPajakModel");
const redis = require("../../config/redis");

const STATUS_TEXT = {
  200: "OK",
  201: "Created",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
};

const logResponse = (label, res) => {
  const detail =
    res.body?.message ||
    (Array.isArray(res.body?.errors) ? res.body.errors.join(" | ") : (res.body?.error || "")) ||
    "";

  console.log(
    `${label} ${res.status} ${STATUS_TEXT[res.status] || ""} ${detail}`
  );
};

describe("SesiBooking — Integration CRUD & Security Exhaustive", () => {
  let tokenC; // Token Owner Utama
  let tokenPenyusup; // Token Owner Lain
  let pelangganID, tipeAsetID, asetID, tarifID, bookingID;

  const unique = Date.now();

  beforeAll(async () => {
    // 1. CLEANUP DATABASE & REDIS
    await Promise.all([
      Permission.deleteMany({}),
      SesiBooking.deleteMany({}),
      Penjualan.deleteMany({}),
      Pelanggan.deleteMany({}),
      TipeAset.deleteMany({}),
      Aset.deleteMany({}),
      Tarif.deleteMany({}),
      Pajak.deleteMany({}),
      ProdukPajak.deleteMany({}),
    ]);
    await redis.flushall();

    // 2. SETUP PERMISSIONS
    await Permission.create([
      { nama: "kelola-booking", grup: "Transaksi", deskripsi: "Dapat mengatur booking" },
      { nama: "kelola-pelanggan", grup: "Manajemen Pelanggan", deskripsi: "Dapat mengatur pelanggan" },
      { nama: "kelola-aset", grup: "Manajemen Aset", deskripsi: "Dapat mengatur aset" },
      { nama: "kelola-tipe-aset", grup: "Manajemen Aset", deskripsi: "Dapat mengatur tipe aset" },
      { nama: "kelola-tarif", grup: "Manajemen Tarif", deskripsi: "Dapat mengatur tarif" },
      { nama: "akses-pos", grup: "Transaksi", deskripsi: "Dapat melakukan transaksi kasir" },
    ]);

    // --- ALUR REGISTER TENANT UTAMA (OWNER A) ---
    await request(app).post("/api/akun/auth/register").send({
      email: `owner.booking.${unique}@test.com`,
      password: "Password123!",
      username: `owner_booking_${unique}`,
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: `owner.booking.${unique}@test.com`,
      password: "Password123!",
      deviceID: `device-test-booking-${unique}`,
    });

    const tokenA = loginRes.body.accessToken;
    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: `Toko Utama ${unique}` });

    const tokenB = tenantRes.body.tokens?.accessToken;
    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Utama", pin: "123456" });

    tokenC = penggunaRes.body.tokens?.accessToken || penggunaRes.body.accessToken || penggunaRes.body.data?.tokens?.accessToken;

    // --- ALUR REGISTER TENANT PENYUSUP (OWNER B) ---
    const emailP = `penyusup.${unique}@test.com`;
    await request(app).post("/api/akun/auth/register").send({
      email: emailP, password: "Password123!", username: `penyusup_${unique}`
    });
    const loginP = await request(app).post("/api/akun/auth/login").send({
      email: emailP, password: "Password123!", deviceID: `dev-p-${unique}`
    });
    const tenantP = await request(app).post("/api/tenant").set("Authorization", `Bearer ${loginP.body.accessToken}`).send({ 
      namaToko: `Toko Penyusup ${unique}` 
    });
    const pengP = await request(app).post("/api/pengguna/register-owner").set("Authorization", `Bearer ${tenantP.body.tokens?.accessToken}`).send({ 
      nama: "Si Penyusup", pin: "123456" 
    });
    tokenPenyusup = pengP.body.tokens?.accessToken || pengP.body.accessToken;

    // --- SETUP DATA MASTER TENANT UTAMA ---
    const pelRes = await request(app).post("/api/pelanggan").set("Authorization", `Bearer ${tokenC}`).send({
      namaPelanggan: "Budi Santoso", tipePelanggan: "umum", nomorHp: "081234567890"
    });
    pelangganID = pelRes.body.data?._id;

    const tipeAsetRes = await request(app).post("/api/tipeaset").set("Authorization", `Bearer ${tokenC}`).send({
      namaTipeAset: `Meja Billiard ${unique}`
    });
    tipeAsetID = tipeAsetRes.body.data?._id;

    const asetRes = await request(app).post("/api/aset").set("Authorization", `Bearer ${tokenC}`).send({
      namaAset: `Meja 01 ${unique}`, tipeAsetID, status: "tersedia"
    });
    asetID = asetRes.body.data?._id;

    const tarifRes = await request(app).post("/api/tarif").set("Authorization", `Bearer ${tokenC}`).send({
      namaTarif: `Tarif Reguler ${unique}`, tipeAsetID, basisPerhitungan: "per jam", harga: 50000, durasiMinimum: 1, prioritas: 1, isDefault: true
    });
    tarifID = tarifRes.body.data?._id;

    // SETUP PAJAK
    const pajakRes = await request(app).post("/api/pajak").set("Authorization", `Bearer ${tokenC}`).send({
      namaPajak: "PPN 10", tarifPajak: 10, modelPerhitungan: 2, tipePajak: true, prioritas: 1, statusPajak: true
    });
    await request(app).post("/api/produkpajak").set("Authorization", `Bearer ${tokenC}`).send({
      assetID: asetID, pajakID: pajakRes.body.data?._id
    });
  });

  const createBooking = async ({ 
    suffix, 
    token = tokenC, 
    dataAset = asetID, 
    waktuMulai = "2026-04-01T10:00:00.000Z", 
    waktuSelesai = "2026-04-01T11:00:00.000Z" 
  }) => {
    const res = await request(app)
      .post("/api/sesibooking")
      .set("Authorization", `Bearer ${token}`)
      .send({
        dataPelanggan: pelangganID,
        dataAset,
        dataTarif: tarifID,
        waktuMulai,
        waktuSelesai,
        status: "Aktif",
        simpanDraft: true
      });
    logResponse(`CREATE BOOKING ${suffix}:`, res);
    return res;
  };

  // --- START SCENARIOS ---

  test("1. POST /api/sesibooking — berhasil membuat booking", async () => {
    const res = await createBooking({ suffix: "001" });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("_id");
    bookingID = res.body.data._id;
  });

  test("2. GET /api/sesibooking — berhasil mengambil semua booking", async () => {
    const res = await request(app).get("/api/sesibooking").set("Authorization", `Bearer ${tokenC}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("3. GET /api/sesibooking/:id — berhasil mengambil booking by ID", async () => {
    const res = await request(app).get(`/api/sesibooking/${bookingID}`).set("Authorization", `Bearer ${tokenC}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("_id", bookingID);
  });

  test("4. GET /api/sesibooking/:id — gagal jika ID tidak ditemukan", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/sesibooking/${fakeID}`).set("Authorization", `Bearer ${tokenC}`);
    expect([400, 404]).toContain(res.statusCode);
  });

  test("5. POST /api/sesibooking — gagal jika waktu bentrok", async () => {
    const res = await createBooking({ 
      suffix: "BENTROK", 
      waktuMulai: "2026-04-01T10:30:00.000Z", 
      waktuSelesai: "2026-04-01T11:30:00.000Z" 
    });
    expect(res.statusCode).toBe(400);
  });

  test("6. POST /api/sesibooking — gagal jika waktuSelesai < waktuMulai", async () => {
    const res = await createBooking({ 
      suffix: "WAKTU-SALAH", 
      waktuMulai: "2026-04-01T12:00:00.000Z", 
      waktuSelesai: "2026-04-01T11:00:00.000Z" 
    });
    expect(res.statusCode).toBe(400);
  });

  test("7. PUT /api/sesibooking/:id — berhasil update booking", async () => {
    const res = await request(app)
      .put(`/api/sesibooking/${bookingID}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        waktuMulai: "2026-04-01T15:00:00.000Z",
        waktuSelesai: "2026-04-01T16:00:00.000Z",
        status: "Aktif"
      });
    expect(res.statusCode).toBe(200);
  });

  test("8. PUT /api/sesibooking/:id — gagal jika tidak ditemukan", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();
    const res = await request(app).put(`/api/sesibooking/${fakeID}`).set("Authorization", `Bearer ${tokenC}`).send({ status: "Aktif" });
    expect([400, 404]).toContain(res.statusCode);
  });

  test("9. DELETE /api/sesibooking/:id — berhasil menghapus booking", async () => {
    const createRes = await createBooking({ 
      suffix: "DELETE", 
      waktuMulai: "2026-04-10T10:00:00.000Z", 
      waktuSelesai: "2026-04-10T11:00:00.000Z" 
    });
    const deleteID = createRes.body.data?._id;
    const res = await request(app).delete(`/api/sesibooking/${deleteID}`).set("Authorization", `Bearer ${tokenC}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: true });
  });

  test("10. DELETE /api/sesibooking/:id — gagal jika tidak ditemukan", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/sesibooking/${fakeID}`).set("Authorization", `Bearer ${tokenC}`);
    expect([400, 404]).toContain(res.statusCode);
  });

  test("11-15. Unauthorized Access — Gagal tanpa token", async () => {
    const res = await request(app).get("/api/sesibooking");
    expect(res.statusCode).toBe(401);
  });

  // --- SECURITY & CHAOS TESTS ---

  describe("Security & Chaos Testing", () => {
    test("S1. Multi-Tenant — Tenant B tidak boleh akses data Tenant A", async () => {
      const res = await request(app).get(`/api/sesibooking/${bookingID}`).set("Authorization", `Bearer ${tokenPenyusup}`);
      expect([400, 404]).toContain(res.statusCode);
    });

    test("S2. Multi-Tenant — Tenant B tidak boleh booking Aset Tenant A", async () => {
      const res = await createBooking({ suffix: "ILLEGAL", token: tokenPenyusup, dataAset: asetID });
      expect(res.statusCode).toBe(400);
      
      const errorMsg = res.body.error || (res.body.errors ? res.body.errors.join(" ") : "");
      expect(errorMsg).toContain("Akses ditolak: aset bukan milik tenant Anda.");
    });

    test("C1. Anti-Tampering — User tidak boleh memanipulasi totalBiaya", async () => {
      const res = await request(app)
        .post("/api/sesibooking")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          dataPelanggan: pelangganID,
          dataAset: asetID,
          waktuMulai: "2026-12-01T10:00:00.000Z",
          waktuSelesai: "2026-12-01T11:00:00.000Z",
          totalBiaya: 100 
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.totalBiaya).toBe(50000);
    });

    test("C2. Transaction Locking — Gagal update jika Penjualan sudah FINAL", async () => {
      const cRes = await createBooking({ suffix: "FINAL-TEST", waktuMulai: "2026-12-02T10:00:00.000Z", waktuSelesai: "2026-12-02T11:00:00.000Z" });
      const bID = cRes.body.data._id;
      const pID = cRes.body.data.dataPenjualan._id;

      await Penjualan.findByIdAndUpdate(pID, { statusPenjualan: "FINAL" });

      const res = await request(app)
        .put(`/api/sesibooking/${bID}`)
        .set("Authorization", `Bearer ${tokenC}`)
        .send({ waktuSelesai: "2026-12-02T12:00:00.000Z" });

      expect(res.statusCode).toBe(400);
      const errorMsg = res.body.error || (res.body.errors ? res.body.errors.join(" ") : "");
      expect(errorMsg).toContain("Booking tidak bisa diubah karena penjualan terkait sudah FINAL.");
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await redis.quit();
  });
});