const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const Permission = require("../../models/permissionModel");
const Penjualan = require("../../models/penjualanModel");
const Produk = require("../../models/produkModel");
const redis = require("../../config/redis");

const unique = Date.now();
const dummyBahanBakuID = new mongoose.Types.ObjectId();

describe("Penjualan — Integration CRUD & Exhaustive Security", () => {
  let tokenC, tokenPenyusup;
  let pelangganID, produkID, kategoriID;
  let finalPenjualanID, draftPenjualanID;

  beforeAll(async () => {
    // 1. CLEANUP
    await Promise.all([
      Permission.deleteMany({}),
      Penjualan.deleteMany({}),
      Produk.deleteMany({}),
    ]);

    // 2. SETUP PERMISSIONS
    await Permission.create([
      { nama: "akses-pos", grup: "Transaksi", deskripsi: "POS" },
      { nama: "kelola-pelanggan", grup: "Pelanggan", deskripsi: "Pelanggan" },
      { nama: "kelola-produk", grup: "Produk", deskripsi: "Produk" },
      { nama: "kelola-kategori", grup: "Produk", deskripsi: "Kategori" },
      { nama: "kelola-pajak", grup: "Pajak", deskripsi: "Pajak" },
    ]);

    // --- REGISTER TENANT UTAMA ---
    await request(app)
      .post("/api/akun/auth/register")
      .send({
        email: `owner.penjualan.${unique}@test.com`,
        password: "Password123!",
        username: `owner_pj_${unique}`,
      });
    const logMain = await request(app)
      .post("/api/akun/auth/login")
      .send({
        email: `owner.penjualan.${unique}@test.com`,
        password: "Password123!",
        deviceID: `dev-pj-${unique}`,
      });
    const tMain = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${logMain.body.accessToken}`)
      .send({ namaToko: `Toko A ${unique}` });
    const pMain = await request(app)
      .post("/api/pengguna/register-owner")
      .set(
        "Authorization",
        `Bearer ${tMain.body.tokens?.accessToken || tMain.body.accessToken}`,
      )
      .send({ nama: "Owner A", pin: "123456" });
    tokenC =
      pMain.body.tokens?.accessToken ||
      pMain.body.accessToken ||
      pMain.body.data?.tokens?.accessToken;

    // --- REGISTER TENANT PENYUSUP ---
    const emailP = `penyusup.${unique}@test.com`;
    await request(app)
      .post("/api/akun/auth/register")
      .send({
        email: emailP,
        password: "Password123!",
        username: `pj_p_${unique}`,
      });
    const logP = await request(app)
      .post("/api/akun/auth/login")
      .send({
        email: emailP,
        password: "Password123!",
        deviceID: `dev-p-${unique}`,
      });
    const tP = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${logP.body.accessToken}`)
      .send({ namaToko: `Toko B ${unique}` });
    const pP = await request(app)
      .post("/api/pengguna/register-owner")
      .set(
        "Authorization",
        `Bearer ${tP.body.tokens?.accessToken || tP.body.accessToken}`,
      )
      .send({ nama: "Owner B", pin: "123456" });
    tokenPenyusup =
      pP.body.tokens?.accessToken ||
      pP.body.accessToken ||
      pP.body.data?.tokens?.accessToken;

    // --- SETUP DATA MASTER ---
    const pel = await request(app)
      .post("/api/pelanggan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ namaPelanggan: "Budi", tipePelanggan: "umum", nomorHp: "08123" });
    pelangganID = pel.body.data._id;

    const kat = await request(app)
      .post("/api/kategori")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ namaKategori: "Food", kodeKategori: `F${unique}` });
    kategoriID = kat.body.data._id;

    const prod = await request(app)
      .post("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaProduk: "Es Teh",
        hargaDasar: 2000,
        hargaJual: 5000,
        kategoriID,
        stok: 100,
        resep: [{ bahanBakuID: dummyBahanBakuID, jumlah: 1, satuan: "pcs" }],
      });
    produkID = prod.body.data._id;
  });

  // Helper untuk membuat payload transaksi yang valid (menghindari undefined _id)
  const getValidPayload = (ref) => ({
    noReferensi: ref,
    pelangganID,
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date().toISOString(),
    itemPenjualan: [{ produkID, jumlah: 1 }],
  });

  test("1. POST — Berhasil buat transaksi FINAL", async () => {
    const res = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send(getValidPayload(`INV-F-${unique}`));
    expect(res.statusCode).toBe(201);
    finalPenjualanID = res.body.data._id;
  });

  test("2. POST — Berhasil buat transaksi DRAFT", async () => {
    const res = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ ...getValidPayload(`INV-D-${unique}`), simpanDraft: true });
    expect(res.statusCode).toBe(201);
    draftPenjualanID = res.body.data._id;
  });

  test("3. POST — noReferensi duplikat harus gagal", async () => {
    const res = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send(getValidPayload(`INV-F-${unique}`));
    expect([400, 409]).toContain(res.statusCode);
  });

  test("4. GET ALL — Berhasil", async () => {
    const res = await request(app)
      .get("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test("5. PUT — Draft bisa difinalisasi", async () => {
    const draft = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ ...getValidPayload(`INV-FINZ-${unique}`), simpanDraft: true });
    const res = await request(app)
      .put(`/api/penjualan/${draft.body.data._id}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ finalize: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.statusPenjualan).toBe("FINAL");
  });

  test("6. PUT — DRAFT bisa VOID", async () => {
    const draft = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ ...getValidPayload(`INV-VOID-${unique}`), simpanDraft: true });
    const res = await request(app)
      .put(`/api/penjualan/${draft.body.data._id}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ statusPenjualan: "VOID" });
    expect(res.statusCode).toBe(200);
  });

  test("7. DELETE — Hanya DRAFT yang boleh dihapus", async () => {
    const draft = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ ...getValidPayload(`INV-DEL-${unique}`), simpanDraft: true });
    const res = await request(app)
      .delete(`/api/penjualan/${draft.body.data._id}`)
      .set("Authorization", `Bearer ${tokenC}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBe(true);
  });

  describe("Security & Chaos Scenarios", () => {
    test("S1. Isolation — Tenant lain tidak boleh lihat data", async () => {
      const res = await request(app)
        .get(`/api/penjualan/${finalPenjualanID}`)
        .set("Authorization", `Bearer ${tokenPenyusup}`);
      expect([400, 404]).toContain(res.statusCode);
    });

    test("C1. Stok Integrity — Transaksi FINAL kurangi stok", async () => {
      // Ambil stok awal
      const prodBefore = await Produk.findById(produkID);
      const stokAwal = prodBefore.stok;

      // Buat transaksi baru dengan jumlah 5
      await request(app)
        .post("/api/penjualan")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          ...getValidPayload(`INV-STOK-${unique}`),
          itemPenjualan: [{ produkID, jumlah: 5 }],
        });

      const prodAfter = await Produk.findById(produkID);
      expect(prodAfter.stok).toBe(stokAwal - 5);
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (redis && redis.status !== "end") {
      await redis.quit();
    }
  });
});