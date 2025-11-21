require("dotenv").config();
const mongoose = require("mongoose");
const Permission = require("./models/permissionModel");

const DB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk";

const permissionsData = [
  { nama: "kelola-pengguna", grup: "Pengguna" },
  { nama: "lihat-pengguna", grup: "Pengguna" },
  { nama: "kelola-role", grup: "Pengguna" },
  { nama: "kelola-posisi", grup: "Pengguna" },
  { nama: "kelola-produk", grup: "Produk" },
  { nama: "lihat-produk", grup: "Produk" },
  { nama: "kelola-kategori", grup: "Produk" },
  { nama: "kelola-bahan-baku", grup: "Produk" },
  { nama: "akses-kasir", grup: "Transaksi" },
  { nama: "riwayat-transaksi", grup: "Transaksi" },
  { nama: "kelola-kas", grup: "Transaksi" },
  { nama: "pembelian-stok", grup: "Inventori" },
  { nama: "opname-stok", grup: "Inventori" },
  { nama: "kelola-absensi", grup: "Karyawan" },
  { nama: "kelola-cuti", grup: "Karyawan" },
  { nama: "lihat-laporan-karyawan", grup: "Karyawan" },
];

const seedPermissions = async () => {
  try {
    await mongoose.connect(DB_URI);
    console.log("✅ Terhubung ke MongoDB...");

    await Permission.deleteMany({});
    console.log("🗑️  Data Permission lama dihapus.");

    await Permission.insertMany(permissionsData);
    console.log("✅ Data Permission berhasil ditambahkan!");
    console.log(`📊 Total: ${permissionsData.length} permission.`);
  } catch (error) {
    console.error("❌ Gagal melakukan seeding:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔒 Koneksi ditutup.");
  }
};

seedPermissions();