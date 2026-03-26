const request = require("supertest");
const app = require("../../../app");
const Permission = require("../../../models/permissionModel");

describe("E2E-01 — Setup Toko Baru (Onboarding)", () => {
  // Token chain: A, B, C
  let tokenA; // token akun owner (sebelum punya tenant)
  let tokenB; // token setelah buat tenant (sudah ada tenantID)
  let tokenC; // token pengguna/owner (PIN token)

  // ID yang dikumpulkan sepanjang alur
  let tenantID;
  let roleID;
  let penggunaID;

  // ─────────────────────────────────────────
  // STEP 1 — Registrasi Akun Owner
  // ─────────────────────────────────────────
  test("Step 1 — Registrasi akun owner berhasil", async () => {
    const res = await request(app).post("/api/akun/auth/register").send({
      email: "owner@kafe-e2e.com",
      password: "KafeOwner2026!",
      username: "owner_kafe_e2e",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "Registrasi berhasil");
    expect(res.body.data).toHaveProperty("email", "owner@kafe-e2e.com");
    expect(res.body.data).not.toHaveProperty("password");
  });

  // ─────────────────────────────────────────
  // STEP 2 — Login Owner
  // ─────────────────────────────────────────
  test("Step 2 — Login owner berhasil dapat accessToken", async () => {
    const res = await request(app).post("/api/akun/auth/login").send({
      email: "owner@kafe-e2e.com",
      password: "KafeOwner2026!",
      deviceID: "desktop-kasir-e2e",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("accessToken");

    tokenA = res.body.accessToken;
    expect(tokenA).toBeTruthy();
  });

  // ─────────────────────────────────────────
  // STEP 3 — Buat Tenant
  // ─────────────────────────────────────────
  test("Step 3 — Buat tenant berhasil, dapat token baru dengan tenantID", async () => {
    const res = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        namaToko: "Kafe E2E Makmur",
        alamat: "Jl. Sudirman No. 45",
        kota: "Pontianak",
        nomorTelepon: "0561-55501234",
        emailBisnis: "cs@kafe-e2e.com",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("namaToko", "Kafe E2E Makmur");
    expect(res.body.tokens).toHaveProperty("accessToken");

    tokenB = res.body.tokens.accessToken;
    tenantID = res.body.data._id;

    expect(tokenB).toBeTruthy();
    expect(tenantID).toBeTruthy();
  });

  // ─────────────────────────────────────────
  // STEP 4
  // ─────────────────────────────────────────
  test("Step 4 — Register pengguna owner berhasil, dapat PIN token", async () => {
    const res = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Ahmad Owner", pin: "123456" });

    expect(res.statusCode).toBe(201);

    tokenC = res.body.accessToken; // ← langsung di root, bukan di tokens{}

    // _id tidak dikembalikan di response — decode dari token saja
    // atau skip assertion penggunaID karena tidak kritis untuk alur ini
    const payload = JSON.parse(
      Buffer.from(tokenC.split(".")[1], "base64").toString(),
    );
    penggunaID = payload.id;

    expect(tokenC).toBeTruthy();
    expect(penggunaID).toBeTruthy();
  });

  // ─────────────────────────────────────────
  // STEP 5
  // ─────────────────────────────────────────
  test("Step 5 — Buat role kasir berhasil", async () => {
    // Seed permission DAN assign ke Role Owner yang sudah ada
    const Role = require("../../../models/roleModel");
    const Permission = require("../../../models/permissionModel");

    // Seed permission
    const perms = await Permission.insertMany([
      // Grup: Staff
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

      // Grup: Produk
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

      // Grup: Toko
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

      // Grup: Laporan
      {
        nama: "laporan-penjualan",
        grup: "Laporan",
        deskripsi: "Dapat melihat omzet dan laporan",
      },

      // Grup: POS
      {
        nama: "akses-pos",
        grup: "Transaksi",
        deskripsi: "Dapat melakukan transaksi kasir",
      },
    ]);

    // Assign semua permission ke Role Owner milik tenant ini
    await Role.findOneAndUpdate(
      { namaRole: "Owner", tenantID },
      { $set: { permissions: perms.map((p) => p._id) } },
    );

    // Re-login PIN untuk dapat token baru yang sudah ada permissions
    const reloginRes = await request(app)
      .post("/api/pengguna/pin-login")
      .set("Authorization", `Bearer ${tokenB}`) // token akun
      .send({ nama: "Ahmad Owner", pin: "123456" });

    if (reloginRes.body.accessToken) {
      tokenC = reloginRes.body.accessToken;
    }

    const res = await request(app)
      .post("/api/role")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaRole: "Kasir",
        deskripsi: "Karyawan kasir yang mengelola transaksi",
      });

    console.log("BUAT ROLE:", res.status, res.body.message ?? "");

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("namaRole", "Kasir");

    roleID = res.body.data._id;
    expect(roleID).toBeTruthy();
  });

  // ─────────────────────────────────────────
  // STEP 6 — Verifikasi PIN Token Bisa Akses API
  // ─────────────────────────────────────────
  test("Step 6 — PIN token kasir valid dan bisa akses API produk", async () => {
    const res = await request(app)
      .get("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`);

    expect(res.statusCode).toBe(200);
  });

  // ─────────────────────────────────────────
  // VERIFIKASI AKHIR — Semua ID terkumpul
  // ─────────────────────────────────────────
  test("Verifikasi akhir — semua entitas onboarding berhasil dibuat", () => {
    expect(tenantID).toBeTruthy();
    expect(roleID).toBeTruthy();
    expect(penggunaID).toBeTruthy();
    expect(tokenC).toBeTruthy();

    console.log("✅ E2E-01 Onboarding selesai");
    console.log("   tenantID  :", tenantID);
    console.log("   roleID    :", roleID);
    console.log("   penggunaID:", penggunaID);
  });
});
