const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const Permission = require("../../models/permissionModel");

describe("Pembayaran — CRUD", () => {
  let tokenC;
  let penjualanID;
  let akunKasID;
  let metodePembayaranID;

  const dummyBahanBakuID = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    // Seed permissions
    await Permission.create([
      {
        nama: "kelola-pembayaran",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengatur pembayaran",
      },
      {
        nama: "kelola-akunkas",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengatur akun kas",
      },
      {
        nama: "kelola-metode-pembayaran",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengatur metode pembayaran",
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
      {
        nama: "akses-pos",
        grup: "Transaksi",
        deskripsi: "Dapat melakukan transaksi kasir",
      },
    ]);

    // Tahap 1: Register & Login
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@toko-pembayaran.com",
      password: "Password123!",
      username: "owner_pembayaran",
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner@toko-pembayaran.com",
      password: "Password123!",
      deviceID: "device-test-pembayaran",
    });
    const tokenA = loginRes.body.accessToken;
    if (!tokenA) throw new Error("Gagal mendapatkan Token A!");

    // Tahap 2: Buat Tenant
    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: "Toko Test Pembayaran" });

    const tokenB = tenantRes.body.tokens?.accessToken;
    if (!tokenB) throw new Error("Gagal mendapatkan Token B!");

    // Tahap 3: Register Owner
    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Test Pembayaran", pin: "123456" });

    tokenC =
      penggunaRes.body.tokens?.accessToken ||
      penggunaRes.body.accessToken ||
      penggunaRes.body.data?.tokens?.accessToken;
    if (!tokenC) throw new Error("Gagal mendapatkan Token C!");

    // Tahap 4: Buat Akun Kas
    const akunKasRes = await request(app)
      .post("/api/akunkas")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaAkun: "kas-01",
        saldo: 500000,
        tipeAkun: "Kas Fisik",
        nomorAkun: "123",
        // tenantID: "69afa9e6752c3263bc9a7d11",
      });

    akunKasID = akunKasRes.body.data?._id;
    if (!akunKasID) {
      console.log("ERROR buat akunKas:", JSON.stringify(akunKasRes.body));
      throw new Error("Gagal membuat akun kas!");
    }

    // Tahap 5: Buat Metode Pembayaran
    const metodeRes = await request(app)
      .post("/api/metodepembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaPembayaran: "Uang Tunai / Cash",
        kategori: "tunai",
        akunKasID,
        isAutomated: false,
        isActive: true,
      });

    metodePembayaranID = metodeRes.body.data?._id;
    if (!metodePembayaranID) {
      console.log(
        "ERROR buat metode pembayaran:",
        JSON.stringify(metodeRes.body),
      );
      throw new Error("Gagal membuat metode pembayaran!");
    }

    // Tahap 6: Buat Pelanggan
    const pelangganRes = await request(app)
      .post("/api/pelanggan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaPelanggan: "Pelanggan Test Bayar",
        tipePelanggan: "umum",
        nomorHp: "08199988877",
      });

    const pelangganID = pelangganRes.body.data?._id;
    if (!pelangganID) {
      console.log("ERROR buat pelanggan:", JSON.stringify(pelangganRes.body));
      throw new Error("Gagal membuat pelanggan!");
    }

    // Tahap 7: Buat Kategori
    const kategoriRes = await request(app)
      .post("/api/kategori")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({ namaKategori: "Kategori Pembayaran", kodeKategori: "KAT-PAY" });

    const kategoriID = kategoriRes.body.data?._id;
    if (!kategoriID) {
      console.log("ERROR buat kategori:", JSON.stringify(kategoriRes.body));
      throw new Error("Gagal membuat kategori!");
    }

    // Tahap 8: Buat Produk
    const produkRes = await request(app)
      .post("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaProduk: "Kopi Test Bayar",
        hargaDasar: 5000,
        hargaJual: 10000,
        kategoriID,
        stok: 50,
        resep: [{ bahanBakuID: dummyBahanBakuID, jumlah: 100, satuan: "ml" }],
      });

    const produkID = produkRes.body.data?._id;
    if (!produkID) {
      console.log("ERROR buat produk:", JSON.stringify(produkRes.body));
      throw new Error("Gagal membuat produk!");
    }

    // Tahap 9: Buat Penjualan (UNPAID)
    const penjualanRes = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        noReferensi: "PAY-TEST-001",
        pelangganID,
        jenisTransaksi: "POS",
        jenisPenjualan: "dine-in",
        tanggalTransaksi: new Date().toISOString(),
        itemPenjualan: [
          {
            produkID,
            namaProduk: "Kopi Test Bayar",
            jumlah: 2,
            hargaJual: 10000,
            subTotal: 20000,
            jumlahDiskon: 0,
            total: 20000,
            jumlahPajak: 0,
            totalharga: 20000,
          },
        ],
        jumlahDiskonTransaksi: 0,
        jumlahPajakTransaksi: 0,
        totalDibayar: 0,
      });
    // gagal: penjualanID tidak pernah terisi karena POST /api/penjualan
    // crash dengan 500 — root cause: pajakService.simulasiHitung is not a function
    // di penjualanService.js:435. perbaiki simulasi pajak agar beforeAll bisa lolos.
    penjualanID = penjualanRes.body.data?._id;
    if (!penjualanID) {
      console.log("ERROR buat penjualan:", JSON.stringify(penjualanRes.body));
      throw new Error(
        "Gagal membuat penjualan! (Pastikan bug pajakService.simulasiHitung sudah difix)",
      );
    }

    console.log(
      "beforeAll selesai | penjualanID:",
      penjualanID,
      "| akunKasID:",
      akunKasID,
      "| metodePembayaranID:",
      metodePembayaranID,
    );
  });

  // Skenario A: Rekam pembayaran lunas berhasil
  test("POST /api/pembayaran — berhasil rekam pembayaran PAID", async () => {
    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID,
        metodePembayaranID,
        noReferensi: "PAY-TEST-001",
        jumlahBayar: 20000,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
        catatan: "Tunai pas",
      });

    console.log("CREATE PEMBAYARAN:", res.status, res.body.message ?? "");
    // beforeAll gagal di Tahap 9, penjualanID = undefined.
    // Semua skenario di bawah tidak akan berjalan sampai bug pajak diperbaiki.
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("status", "PAID");
    expect(res.body.data).toHaveProperty("jumlahBayar", 20000);
  });

  // Skenario B: PAID tanpa tanggalBayar harus ditolak
  test("POST /api/pembayaran — PAID tanpa tanggalBayar harus 400", async () => {
    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID,
        metodePembayaranID,
        noReferensi: "PAY-TEST-002",
        jumlahBayar: 20000,
        // tanggalBayar sengaja tidak dikirim
        status: "PAID",
      });

    expect(res.statusCode).toBe(400);
  });

  // Skenario C: Verifikasi statusBayar penjualan berubah jadi PAID
  test("GET /api/penjualan/:id — statusBayar harus PAID setelah pembayaran", async () => {
    const res = await request(app)
      .get(`/api/penjualan/${penjualanID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("statusBayar", "PAID");
    expect(res.body.data).toHaveProperty("sisaTagihan", 0);
  });

  // Skenario D: Akses tanpa token harus 401
  test("POST /api/pembayaran — tanpa token harus 401", async () => {
    const res = await request(app)
      .post("/api/pembayaran")
      .send({ penjualanID, jumlahBayar: 20000 });

    expect(res.statusCode).toBe(401);
  });
});
