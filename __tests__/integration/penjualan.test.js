const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const Permission = require("../../models/permissionModel");

describe("Penjualan — CRUD", () => {
  let tokenC;
  let pelangganID;
  let produkID;
  let kategoriID;
  let penjualanID;

  const dummyBahanBakuID = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    // Seed permissions
    await Permission.create([
      {
        nama: "akses-pos",
        grup: "Transaksi",
        deskripsi: "Dapat melakukan transaksi kasir",
      },
      {
        nama: "kelola-pelanggan",
        grup: "Manajemen Pelanggan",
        deskripsi: "Dapat mengatur pelanggan",
      },
      {
        nama: "kelola-produk",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur produk",
      },
      {
        nama: "kelola-kategori",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur kategori",
      },
    ]);

    // Tahap 1: Register & Login
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@toko-penjualan.com",
      password: "Password123!",
      username: "owner_penjualan",
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner@toko-penjualan.com",
      password: "Password123!",
      deviceID: "device-test-penjualan",
    });
    const tokenA = loginRes.body.accessToken;
    if (!tokenA) throw new Error("Gagal mendapatkan Token A!");

    // Tahap 2: Buat Tenant → ambil tokenB
    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: "Toko Test Penjualan" });

    const tokenB = tenantRes.body.tokens?.accessToken;
    if (!tokenB) throw new Error("Gagal mendapatkan Token B!");

    // Tahap 3: Register Owner → ambil tokenC
    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Test Penjualan", pin: "123456" });

    tokenC =
      penggunaRes.body.tokens?.accessToken ||
      penggunaRes.body.accessToken ||
      penggunaRes.body.data?.tokens?.accessToken;
    if (!tokenC) throw new Error("Gagal mendapatkan Token C!");

    // Tahap 4: Buat Pelanggan
    const pelangganRes = await request(app)
      .post("/api/pelanggan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaPelanggan: "Pelanggan Test",
        tipePelanggan: "umum",
        nomorHp: "08112233445",
      });

    pelangganID = pelangganRes.body.data?._id;
    if (!pelangganID) {
      console.log("ERROR buat pelanggan:", JSON.stringify(pelangganRes.body));
      throw new Error("Gagal membuat pelanggan!");
    }

    // Tahap 5: Buat Kategori
    const kategoriRes = await request(app)
      .post("/api/kategori")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ namaKategori: "Kategori Test Penjualan", kodeKategori: "KTP" });

    kategoriID = kategoriRes.body.data?._id;
    if (!kategoriID) {
      console.log("ERROR buat kategori:", JSON.stringify(kategoriRes.body));
      throw new Error("Gagal membuat kategori!");
    }

    // Tahap 6: Buat Produk
    const produkRes = await request(app)
      .post("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        // catatan: jangan masukkan tenantID lagi karena sudah di-handle di controller, justru akan bikin error kalau dimasukkan
        namaProduk: "Es Teh Manis",
        hargaDasar: 3000,
        hargaJual: 8000,
        kategoriID,
        stok: 100,
        resep: [{ bahanBakuID: dummyBahanBakuID, jumlah: 200, satuan: "ml" }],
      });

    produkID = produkRes.body.data?._id;
    if (!produkID) {
      console.log("ERROR buat produk:", JSON.stringify(produkRes.body));
      throw new Error("Gagal membuat produk!");
    }

    console.log(
      "beforeAll selesai ✅ | pelangganID:",
      pelangganID,
      "| produkID:",
      produkID,
    );
  });

  // Skenario A: Buat transaksi POS dine-in berhasil (UNPAID)

  test("POST /api/penjualan — berhasil buat transaksi UNPAID", async () => {
    const res = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        noReferensi: "POS-TEST-001",
        pelangganID,
        jenisTransaksi: "POS",
        jenisPenjualan: "dine-in",
        tanggalTransaksi: new Date().toISOString(),
        itemPenjualan: [
          {
            produkID,
            namaProduk: "Es Teh Manis",
            jumlah: 2,
            hargaJual: 8000,
            subTotal: 16000,
            jumlahDiskon: 0,
            total: 16000,
            jumlahPajak: 0,
            totalharga: 16000,
          },
        ],
        jumlahDiskonTransaksi: 0,
        jumlahPajakTransaksi: 0,
        totalDibayar: 0,
      });

    console.log("CREATE PENJUALAN:", res.status, res.body.message ?? "");

    // Error 500: pajakService.simulasiHitung() yang tidak ada.
    // cek nama fungsi asli di pajakService.js dan sesuaikan di penjualanService.js:435

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("statusBayar", "UNPAID");
    expect(res.body.data).toHaveProperty("totalTagihan", 16000);
    expect(res.body.data).toHaveProperty("sisaTagihan", 16000);

    // CASCADING: penjualanID tidak pernah terisi karena Skenario A gagal.
    // Skenario D dan E ikut gagal akibat ini.

    penjualanID = res.body.data._id;
  });

  // Skenario B: Transaksi dengan diskon global langsung PAID
  test("POST /api/penjualan — transaksi dengan diskon global statusBayar PAID", async () => {
    // gagal seperti Skenario A — root cause pajakService.simulasiHitung
    const res = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        noReferensi: "POS-TEST-002",
        pelangganID,
        jenisTransaksi: "POS",
        jenisPenjualan: "dine-in",
        tanggalTransaksi: new Date().toISOString(),
        itemPenjualan: [
          {
            produkID,
            namaProduk: "Es Teh Manis",
            jumlah: 3,
            hargaJual: 8000,
            subTotal: 24000,
            jumlahDiskon: 0,
            total: 24000,
            jumlahPajak: 0,
            totalharga: 24000,
          },
        ],
        jumlahDiskonTransaksi: 4000,
        jumlahPajakTransaksi: 0,
        totalDibayar: 20000,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("totalHargaProduk", 24000);
    expect(res.body.data).toHaveProperty("totalTagihan", 20000);
    expect(res.body.data).toHaveProperty("statusBayar", "PAID");
  });

  // Skenario C: noReferensi duplikat dalam satu tenant harus gagal
  test("POST /api/penjualan — noReferensi duplikat harus 400/409", async () => {
    // Skenario A gagal sehingga "POS-TEST-001" tidak pernah tersimpan di DB.
    // Akibatnya request ini tidak dianggap duplikat, melainkan kembali memanggil
    // create() yang juga crash dengan 500 karena pajakService.simulasiHitung.
    const res = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        noReferensi: "POS-TEST-001", // duplikat dari Skenario A
        pelangganID,
        jenisTransaksi: "POS",
        jenisPenjualan: "dine-in",
        tanggalTransaksi: new Date().toISOString(),
        itemPenjualan: [
          {
            produkID,
            namaProduk: "Es Teh Manis",
            jumlah: 1,
            hargaJual: 8000,
            subTotal: 8000,
            jumlahDiskon: 0,
            total: 8000,
            jumlahPajak: 0,
            totalharga: 8000,
          },
        ],
        jumlahDiskonTransaksi: 0,
        jumlahPajakTransaksi: 0,
        totalDibayar: 0,
      });

    expect([400, 409]).toContain(res.statusCode);
  });

  // Skenario D: Get semua penjualan milik tenant sendiri
  test("GET /api/penjualan — hanya mengembalikan penjualan milik tenant sendiri", async () => {
    const res = await request(app)
      .get("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // gagal. DB kosong karena tidak ada penjualan yang berhasil dibuat.
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // Skenario E: Get penjualan by ID
  test("GET /api/penjualan/:id — berhasil ambil penjualan by ID", async () => {
    const res = await request(app)
      .get(`/api/penjualan/${penjualanID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    // penjualanID = undefined karena Skenario A gagal.
    // Request menjadi GET /api/penjualan/undefined → 404.

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("_id", penjualanID);
    expect(res.body.data).toHaveProperty("noReferensi", "POS-TEST-001");
  });

  // Skenario F: Akses tanpa token harus ditolak
  test("POST /api/penjualan — tanpa token harus 401", async () => {
    const res = await request(app)
      .post("/api/penjualan")
      .send({ noReferensi: "POS-NO-AUTH" });

    expect(res.statusCode).toBe(401);
  });
});
