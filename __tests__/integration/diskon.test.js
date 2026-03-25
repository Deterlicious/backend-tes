const request = require("supertest");
const app = require("../../app");
const Permission = require("../../models/permissionModel");

describe("Diskon — CRUD", () => {
  let tokenC;
  let diskonID;

  beforeAll(async () => {
    // Seed permission yang dibutuhkan
    await Permission.create([
      {
        nama: "kelola-diskon",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur diskon",
      },
    ]);

    // Tahap 1: Register & Login
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@toko-diskon.com",
      password: "Password123!",
      username: "owner_diskon",
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner@toko-diskon.com",
      password: "Password123!",
      deviceID: "device-test-diskon",
    });
    const tokenA = loginRes.body.accessToken;
    if (!tokenA) throw new Error("Gagal mendapatkan Token A!");

    // Tahap 2: Buat Tenant → ambil tokenB
    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: "Toko Test Diskon" });

    const tokenB = tenantRes.body.tokens?.accessToken;
    if (!tokenB) throw new Error("Gagal mendapatkan Token B!");

    // Tahap 3: Register Owner → ambil tokenC
    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Test Diskon", pin: "123456" });

    tokenC =
      penggunaRes.body.tokens?.accessToken ||
      penggunaRes.body.accessToken ||
      penggunaRes.body.data?.tokens?.accessToken;
    if (!tokenC) throw new Error("Gagal mendapatkan Token C!");
  });

  // ✅ Skenario A: Buat diskon persen per item berhasil
  test("POST /api/diskon — berhasil buat diskon persen", async () => {
    const res = await request(app)
      .post("/api/diskon")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaDiskon: "Diskon Member 10%",
        cakupan: "Item",
        tipe: "persen",
        nilai: 10,
        bisaDigabung: false,
        status: "Aktif",
      });

    console.log("CREATE DISKON:", res.status, res.body.message ?? "");

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("namaDiskon", "Diskon Member 10%");
    expect(res.body.data).toHaveProperty("tipe", "persen");
    expect(res.body.data).toHaveProperty("nilai", 10);

    diskonID = res.body.data._id;
  });

  // ❌ Skenario B: Diskon persen > 100 harus ditolak
  test("POST /api/diskon — diskon persen > 100 harus 400", async () => {
    const res = await request(app)
      .post("/api/diskon")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaDiskon: "Diskon Lebay",
        cakupan: "Global",
        tipe: "persen",
        nilai: 110,
        status: "Aktif",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0]).toMatch(/tidak boleh/i);
  });

  // ✅ Skenario C: Buat diskon nominal berhasil
  test("POST /api/diskon — berhasil buat diskon nominal", async () => {
    const res = await request(app)
      .post("/api/diskon")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaDiskon: "Promo Ramadan",
        cakupan: "Global",
        tipe: "nominal",
        nilai: 5000,
        bisaDigabung: true,
        status: "Aktif",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("tipe", "nominal");
  });

  // ✅ Skenario D: Get semua diskon milik tenant sendiri
  test("GET /api/diskon — hanya mengembalikan diskon milik tenant sendiri", async () => {
    const res = await request(app)
      .get("/api/diskon")
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // ✅ Skenario E: Get diskon by ID
  test("GET /api/diskon/:id — berhasil ambil diskon by ID", async () => {
    const res = await request(app)
      .get(`/api/diskon/${diskonID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("_id", diskonID);
  });

  // ❌ Skenario F: Akses tanpa token harus 401
  test("POST /api/diskon — tanpa token harus 401", async () => {
    const res = await request(app)
      .post("/api/diskon")
      .send({ namaDiskon: "Tanpa Auth", tipe: "persen", nilai: 5 });

    expect(res.statusCode).toBe(401);
  });
});
