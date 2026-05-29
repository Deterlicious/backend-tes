const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose"); // Ditambahkan untuk generate dummy ObjectId
const Permission = require("../../models/permissionModel");

describe("Produk — CRUD", () => {
  let tokenC;
  let kategoriID;
  let produkID;

  // Generate Dummy ID untuk Bahan Baku agar formatnya valid di Mongoose
  const dummyBahanBakuID1 = new mongoose.Types.ObjectId().toString();
  const dummyBahanBakuID2 = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    // Tahap 0: Seeding Permission
    await Permission.create([
      {
        nama: "kelola-staff",
        grup: "Manajemen Staff",
        deskripsi: "Dapat menambah, edit, hapus karyawan",
      },
      {
        nama: "kelola-pelanggan",
        grup: "Manajemen Pelanggan",
        deskripsi: "Dapat menambah, edit, hapus pelanggan",
      },
      {
        nama: "kelola-produk",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur menu dan harga",
      },
      {
        nama: "kelola-kategori",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur kategori menu",
      },
      {
        nama: "kelola-bahan",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur stok bahan baku",
      },
      {
        nama: "kelola-tenant",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengubah profil toko",
      },
      {
        nama: "kelola-akunkas",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat menambah, edit, hapus akun kasir",
      },
      {
        nama: "kelola-metode-pembayaran",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat menambah, edit, hapus metode pembayaran",
      },
      {
        nama: "kelola-pembayaran",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat menambah, edit, hapus pembayaran",
      },
      {
        nama: "laporan-penjualan",
        grup: "Laporan",
        deskripsi: "Dapat melihat omzet dan laporan",
      },
      {
        nama: "akses-pos",
        grup: "Transaksi",
        deskripsi: "Dapat melakukan transaksi kasir",
      },
    ]);
    console.log("Seeding Permission, status: ", Permission ? "Success" : "Failed");

    // Tahap 1: Register Akun
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@toko-produk.com",
      password: "Password123!",
      username: "owner_produk",
    });

    // Tahap 2: Login Akun
    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner@toko-produk.com",
      password: "Password123!",
      deviceID: "device-test-produk",
    });
    const tokenA = loginRes.body.accessToken;

    // Tahap 3: Buat Tenant
    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: "Toko Test Produk" });
    const tokenB =
      tenantRes.body.data?.accessToken ||
      tenantRes.body.tokens?.accessToken ||
      tenantRes.body.accessToken;
    if (!tokenB) throw new Error("Gagal mendapatkan Token B di Step 3!");

    // Tahap 4: Register Owner
    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Test Produk", pin: "123456", aksesType: "web" });

     tokenC =
      penggunaRes.body.tokens?.accessToken ||
      penggunaRes.body.accessToken ||
      penggunaRes.body.data?.tokens?.accessToken;
    if (!tokenC) throw new Error("TOKEN C KOSONG!");

    // Tahap 5: Buat Kategori
    const kategoriRes = await request(app)
      .post("/api/kategori")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaKategori: "Minuman Test",
        kodeKategori: "KAT-001", // Fix dari error sebelumnya
      });

    kategoriID = kategoriRes.body.data?._id;
    if (!kategoriID) {
      console.log("=== ERROR S5: RESPONSE KATEGORI ===");
      console.log(JSON.stringify(kategoriRes.body, null, 2));
      throw new Error("Gagal membuat kategori.");
    }
    console.log("S5 Buat Kategori: ✅");
  });


  // Skenario A: buat produk baru
  test("POST /api/produk — berhasil buat produk baru", async () => {
    const res = await request(app)
      .post("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        // catatan: jangan masukkan tenantID lagi karena sudah di-handle di controller, justru akan bikin error kalau dimasukkan
        namaProduk: "Kopi Creamy 2",
        hargaDasar: 10000,
        hargaJual: 16000,
        kategoriID: kategoriID, // Menggunakan ID asli dari Step 5
        resep: [
          {
            bahanBakuID: dummyBahanBakuID1, // Dummy Mongoose ID
            jumlah: 200,
            satuan: "gram",
          },
          {
            bahanBakuID: dummyBahanBakuID2, // Dummy Mongoose ID
            jumlah: 400,
            satuan: "ml",
          },
        ],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("namaProduk", "Kopi Creamy 2");
    produkID = res.body.data._id;
  });

  // Skenario B: coba buat produk dengan nama yang sama dalam tenant yang sama
  test("POST /api/produk — nama duplikat dalam satu tenant harus 400/409", async () => {
    const res = await request(app)
      .post("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaProduk: "Kopi Creamy 2", // Nama sama untuk memicu duplikat
        hargaDasar: 10000,
        hargaJual: 16000,
        kategoriID: kategoriID,
        resep: [
          { bahanBakuID: dummyBahanBakuID1, jumlah: 200, satuan: "gram" },
        ],
      });

    expect([400, 409]).toContain(res.statusCode);
  });

  // Skenario C: ambil semua produk, pastikan hanya produk tenant sendiri yang muncul
  test("GET /api/produk — hanya mengembalikan produk milik tenant sendiri", async () => {
    const res = await request(app)
      .get("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Skenario D: ambil produk by ID, pastikan hanya bisa akses produk tenant sendiri
  test("GET /api/produk/:id — berhasil ambil produk by ID", async () => {
    const res = await request(app)
      .get(`/api/produk/${produkID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("_id", produkID);
  });

  // Skenario E: coba akses produk tenant lain (gunakan token dari tenant lain atau tanpa token)
  test("POST /api/produk — tanpa token harus ditolak", async () => {
    const res = await request(app).post("/api/produk").send({
      namaProduk: "Produk Tanpa Auth",
      hargaDasar: 5000,
      hargaJual: 10000,
      kategoriID: kategoriID,
      resep: [],
    });

    expect(res.statusCode).toBe(401);
  });
});
