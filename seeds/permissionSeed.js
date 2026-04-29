require("dotenv").config();
const mongoose = require("mongoose");

// =======================
// Permission Model Inline
// =======================
const PermissionSchema = new mongoose.Schema({
  nama: { type: String, required: true, unique: true },
  grup: { type: String, required: true },
  deskripsi: String,
});

const Permission =
  mongoose.models.Permission ||
  mongoose.model("Permission", PermissionSchema);

// =======================
// DATA PERMISSION SEED
// =======================
const permissionsList = [
  // =====================
  // AKUN
  // =====================
  { nama: "read-akun", grup: "Akun", deskripsi: "Melihat akun sendiri" },
  { nama: "update-akun", grup: "Akun", deskripsi: "Update akun sendiri" },

  // =====================
  // TENANT
  // =====================
  { nama: "read-tenant", grup: "Tenant", deskripsi: "Lihat toko" },
  { nama: "update-tenant", grup: "Tenant", deskripsi: "Update toko" },
  { nama: "delete-tenant", grup: "Tenant", deskripsi: "Hapus toko" },

  // =====================
  // PENGGUNA
  // =====================
  { nama: "read-pengguna", grup: "Pengguna", deskripsi: "Lihat staf" },
  { nama: "create-pengguna", grup: "Pengguna", deskripsi: "Tambah staf" },
  { nama: "update-pengguna", grup: "Pengguna", deskripsi: "Edit staf" },
  { nama: "delete-pengguna", grup: "Pengguna", deskripsi: "Hapus staf" },
  {
    nama: "kelola-staff",
    grup: "Pengguna",
    deskripsi: "Kelola role dan permission staf",
  },

  // =====================
  // ROLE
  // =====================
  { nama: "read-role", grup: "Role", deskripsi: "Lihat role" },
  { nama: "create-role", grup: "Role", deskripsi: "Tambah role" },
  { nama: "update-role", grup: "Role", deskripsi: "Edit role" },
  { nama: "delete-role", grup: "Role", deskripsi: "Hapus role" },

  // =====================
  // PERMISSION (MASTER)
  // =====================
  {
    nama: "read-permission",
    grup: "Permission",
    deskripsi: "Lihat permission",
  },
  {
    nama: "create-permission",
    grup: "Permission",
    deskripsi: "Tambah permission",
  },
  {
    nama: "update-permission",
    grup: "Permission",
    deskripsi: "Edit permission",
  },
  {
    nama: "delete-permission",
    grup: "Permission",
    deskripsi: "Hapus permission",
  },

  // =====================
  // INVENTORY WMS
  // =====================
  { nama: "read-inventory", grup: "Inventory", deskripsi: "Lihat stok" },
  {
    nama: "update-inventory-minimum",
    grup: "Inventory",
    deskripsi: "Edit minimum stok",
  },
  {
    nama: "opname-inventory",
    grup: "Inventory",
    deskripsi: "Koreksi stok",
  },

  // =====================
  // JURNAL STOK
  // =====================
  {
    nama: "read-jurnal-stok",
    grup: "Jurnal Stok",
    deskripsi: "Lihat riwayat pergerakan stok",
  },
  {
    nama: "kelola-jurnal-stok",
    grup: "Jurnal Stok",
    deskripsi: "Tambah, edit, dan hapus jurnal stok manual",
  },

  // =====================
  // DASHBOARD GUDANG
  // =====================
  {
    nama: "read-dashboard-gudang",
    grup: "Dashboard",
    deskripsi: "Lihat ringkasan aktivitas gudang",
  },
  {
    nama: "read-dashboard-outlet",
    grup: "Dashboard",
    deskripsi: "Lihat ringkasan aktivitas outlet",
  },

  // =====================
  // PERMINTAAN STOK
  // =====================
  {
    nama: "read-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Lihat permintaan",
  },
  {
    nama: "create-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Buat permintaan",
  },
  {
    nama: "update-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Ubah draft dan submit permintaan",
  },
  {
    nama: "approve-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Setujui permintaan",
  },
  {
    nama: "reject-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Tolak permintaan",
  },

  // =====================
  // TRANSFER STOK
  // =====================
  {
    nama: "read-transfer-stok",
    grup: "Transfer Stok",
    deskripsi: "Lihat transfer",
  },
  {
    nama: "create-transfer-stok",
    grup: "Transfer Stok",
    deskripsi: "Buat transfer",
  },
  {
    nama: "approve-transfer-stok",
    grup: "Transfer Stok",
    deskripsi: "Kirim barang",
  },
  {
    nama: "receive-transfer-stok",
    grup: "Transfer Stok",
    deskripsi: "Terima barang",
  },
  {
    nama: "cancel-transfer-stok",
    grup: "Transfer Stok",
    deskripsi: "Batalkan transfer",
  },

  // =====================
  // MANEJEMEN PELANGGAN
  // =====================
  {
    nama: "kelola-pelanggan",
    grup: "Manajemen Pelanggan",
    deskripsi: "Dapat menambah, edit, hapus pelanggan",
  },

  // =====================
  // MANEJEMEN PRODUK
  // =====================
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

  // =====================
  // PENGATURAN TOKO
  // =====================
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

  // =====================
  // LAPORAN
  // =====================
  {
    nama: "laporan-penjualan",
    grup: "Laporan",
    deskripsi: "Dapat melihat omzet dan laporan",
  },

  // =====================
  // POS
  // =====================
  {
    nama: "akses-pos",
    grup: "Transaksi",
    deskripsi: "Dapat melakukan transaksi kasir",
  },
];

// =======================
// SEED FUNCTION
// =======================
const seedDB = async () => {
  try {
    const dbURI =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk";

    await mongoose.connect(dbURI);
    console.log("🔌 Terhubung ke MongoDB");

    // Bersihkan data lama
    await Permission.deleteMany({});
    console.log("🧹 Permission lama dihapus");

    // Insert data baru
    await Permission.insertMany(permissionsList);
    console.log(
      `✅ Berhasil seed ${permissionsList.length} permissions`
    );

    process.exit();
  } catch (err) {
    console.error("❌ Gagal seed:", err);
    process.exit(1);
  }
};

seedDB();
