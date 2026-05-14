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
  mongoose.models.Permission || mongoose.model("Permission", PermissionSchema);

// =======================
// DATA PERMISSION SEED
// =======================
const permissionsList = [
  // Akun
  { nama: "read-akun", grup: "Akun", deskripsi: "Melihat akun sendiri" },
  { nama: "update-akun", grup: "Akun", deskripsi: "Update akun sendiri" },

  // Tenant
  { nama: "read-tenant", grup: "Tenant", deskripsi: "Lihat toko" },
  { nama: "update-tenant", grup: "Tenant", deskripsi: "Update toko" },
  { nama: "delete-tenant", grup: "Tenant", deskripsi: "Hapus toko" },

  // Akun Kas
  {
    nama: "read-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Lihat akun kas/bank",
  },
  {
    nama: "create-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Tambah akun kas/bank",
  },
  {
    nama: "update-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Edit akun kas/bank",
  },
  {
    nama: "delete-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Hapus akun kas/bank",
  },

  // Pengguna
  { nama: "read-pengguna", grup: "Pengguna", deskripsi: "Lihat staf" },
  { nama: "create-pengguna", grup: "Pengguna", deskripsi: "Tambah staf" },
  { nama: "update-pengguna", grup: "Pengguna", deskripsi: "Edit staf" },
  { nama: "delete-pengguna", grup: "Pengguna", deskripsi: "Hapus staf" },

  // Role
  { nama: "read-role", grup: "Role", deskripsi: "Lihat role" },
  { nama: "create-role", grup: "Role", deskripsi: "Tambah role" },
  { nama: "update-role", grup: "Role", deskripsi: "Edit role" },
  { nama: "delete-role", grup: "Role", deskripsi: "Hapus role" },

  // Permission
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

  // Kategori
  {
    nama: "read-kategori",
    grup: "Manajemen Produk",
    deskripsi: "Lihat kategori menu",
  },
  {
    nama: "create-kategori",
    grup: "Manajemen Produk",
    deskripsi: "Tambah kategori",
  },
  {
    nama: "update-kategori",
    grup: "Manajemen Produk",
    deskripsi: "Edit kategori",
  },
  {
    nama: "delete-kategori",
    grup: "Manajemen Produk",
    deskripsi: "Hapus kategori",
  },

  // Produk
  {
    nama: "read-produk",
    grup: "Manajemen Produk",
    deskripsi: "Lihat menu dan harga",
  },
  {
    nama: "create-produk",
    grup: "Manajemen Produk",
    deskripsi: "Tambah menu baru",
  },
  {
    nama: "update-produk",
    grup: "Manajemen Produk",
    deskripsi: "Edit menu dan harga",
  },
  { nama: "delete-produk", grup: "Manajemen Produk", deskripsi: "Hapus menu" },

  // Bahan
  {
    nama: "read-bahan",
    grup: "Manajemen Produk",
    deskripsi: "Lihat stok bahan baku",
  },
  {
    nama: "create-bahan",
    grup: "Manajemen Produk",
    deskripsi: "Tambah bahan baku",
  },
  {
    nama: "update-bahan",
    grup: "Manajemen Produk",
    deskripsi: "Edit bahan baku",
  },
  {
    nama: "delete-bahan",
    grup: "Manajemen Produk",
    deskripsi: "Hapus bahan baku",
  },

  // Tipe Aset
  {
    nama: "create-tipe-aset",
    grup: "Manajemen Aset",
    deskripsi: "Menambah kategori/tipe aset baru",
  },
  {
    nama: "update-tipe-aset",
    grup: "Manajemen Aset",
    deskripsi: "Mengubah nama atau deskripsi tipe aset",
  },
  {
    nama: "delete-tipe-aset",
    grup: "Manajemen Aset",
    deskripsi: "Menghapus kategori/tipe aset",
  },

  // Aset
  {
    nama: "create-aset",
    grup: "Manajemen Aset",
    deskripsi: "Menambah aset baru untuk disewakan",
  },
  {
    nama: "update-aset",
    grup: "Manajemen Aset",
    deskripsi: "Mengubah data atau status aset",
  },
  {
    nama: "delete-aset",
    grup: "Manajemen Aset",
    deskripsi: "Menghapus data aset dari sistem",
  },

  // Tarif
  {
    nama: "create-tarif",
    grup: "Manajemen Tarif",
    deskripsi: "Membuat aturan tarif atau harga sewa baru",
  },
  {
    nama: "update-tarif",
    grup: "Manajemen Tarif",
    deskripsi: "Mengubah nominal, durasi, atau hari aktif tarif",
  },
  {
    nama: "delete-tarif",
    grup: "Manajemen Tarif",
    deskripsi: "Menghapus data tarif dari sistem",
  },

  // Diskon
  {
    nama: "create-diskon",
    grup: "Manajemen Diskon",
    deskripsi: "Membuat diskon baru",
  },
  {
    nama: "update-diskon",
    grup: "Manajemen Diskon",
    deskripsi: "Mengedit diskon",
  },
  {
    nama: "delete-diskon",
    grup: "Manajemen Diskon",
    deskripsi: "Menghapus diskon",
  },

  // Metode pembayaran
  {
    nama: "create-metode-pembayaran",
    grup: "Metode Pembayaran",
    deskripsi: "Tambah metode pembayaran",
  },
  {
    nama: "update-metode-pembayaran",
    grup: "Metode Pembayaran",
    deskripsi: "Edit metode pembayaran",
  },
  {
    nama: "delete-metode-pembayaran",
    grup: "Metode Pembayaran",
    deskripsi: "Hapus metode pembayaran",
  },

  // Pelanggan
  {
    nama: "read-pelanggan",
    grup: "Manajemen Pelanggan",
    deskripsi: "Melihat data pelanggan",
  },
  {
    nama: "create-pelanggan",
    grup: "Manajemen Pelanggan",
    deskripsi: "Menambah data pelanggan",
  },
  {
    nama: "update-pelanggan",
    grup: "Manajemen Pelanggan",
    deskripsi: "Mengedit data pelanggan",
  },
  {
    nama: "delete-pelanggan",
    grup: "Manajemen Pelanggan",
    deskripsi: "Menghapus pelanggan",
  },

  // Pos
  {
    nama: "akses-pos",
    grup: "Transaksi",
    deskripsi: "Dapat melakukan transaksi kasir",
  },

  // Penjualan
  {
    nama: "read-penjualan",
    grup: "Penjualan",
    deskripsi: "Lihat data riwayat penjualan",
  },
  {
    nama: "create-penjualan",
    grup: "Penjualan",
    deskripsi: "Buat transaksi penjualan baru",
  },
  {
    nama: "update-penjualan",
    grup: "Penjualan",
    deskripsi: "Edit atau void transaksi penjualan",
  },
  {
    nama: "delete-penjualan",
    grup: "Penjualan",
    deskripsi: "Hapus permanen data penjualan",
  },

  // Booking
  {
    nama: "read-booking",
    grup: "Manajemen Booking",
    deskripsi: "Melihat daftar sesi booking aset",
  },
  {
    nama: "create-booking",
    grup: "Manajemen Booking",
    deskripsi: "Membuat sesi booking baru",
  },
  {
    nama: "update-booking",
    grup: "Manajemen Booking",
    deskripsi: "Mengubah jadwal atau membatalkan sesi booking",
  },
  {
    nama: "delete-booking",
    grup: "Manajemen Booking",
    deskripsi: "Menghapus riwayat sesi booking",
  },

  // Pembayaran
  {
    nama: "read-pembayaran",
    grup: "Pembayaran",
    deskripsi: "Lihat data pembayaran",
  },
  {
    nama: "create-pembayaran",
    grup: "Pembayaran",
    deskripsi: "Tambah pembayaran",
  },
  {
    nama: "update-pembayaran",
    grup: "Pembayaran",
    deskripsi: "Edit pembayaran",
  },
  {
    nama: "delete-pembayaran",
    grup: "Pembayaran",
    deskripsi: "Hapus pembayaran",
  },

  // Akun Kas
  {
    nama: "read-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Lihat akun kas/bank",
  },
  {
    nama: "create-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Tambah akun kas/bank",
  },
  {
    nama: "update-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Edit akun kas/bank",
  },
  {
    nama: "delete-akunkas",
    grup: "Pengaturan Toko",
    deskripsi: "Hapus akun kas/bank",
  },

  // Inventory
  { nama: "read-inventory", grup: "Inventory", deskripsi: "Lihat stok" },
  {
    nama: "update-inventory-minimum",
    grup: "Inventory",
    deskripsi: "Edit minimum stok",
  },
  { nama: "opname-inventory", grup: "Inventory", deskripsi: "Koreksi stok" },

  // Jurnal Stok
  {
    nama: "read-jurnal-stok",
    grup: "Jurnal Stok",
    deskripsi: "Lihat riwayat pergerakan stok",
  },
  {
    nama: "create-jurnal-stok",
    grup: "Jurnal Stok",
    deskripsi: "Tambah jurnal stok manual",
  },
  {
    nama: "update-jurnal-stok",
    grup: "Jurnal Stok",
    deskripsi: "Edit jurnal stok manual",
  },
  {
    nama: "delete-jurnal-stok",
    grup: "Jurnal Stok",
    deskripsi: "Hapus jurnal stok manual",
  },

  // Permintaan Stok
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
    nama: "approve-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Setujui permintaan",
  },
  {
    nama: "reject-permintaan-stok",
    grup: "Permintaan Stok",
    deskripsi: "Tolak permintaan",
  },

  // Transfer Stok
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

  // Dashboard
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

  // Laporan
  {
    nama: "read-laporan",
    grup: "Laporan",
    deskripsi: "Dapat melihat omzet dan laporan",
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
    console.log(`✅ Berhasil seed ${permissionsList.length} permissions`);

    process.exit();
  } catch (err) {
    console.error("❌ Gagal seed:", err);
    process.exit(1);
  }
};

seedDB();
