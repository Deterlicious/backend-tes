require("dotenv").config();
const mongoose = require("mongoose");

// Definisi Model Inline (agar tidak perlu import file model lain)
const PermissionSchema = new mongoose.Schema({
  nama: { type: String, required: true, unique: true },
  deskripsi: String,
});
const Permission = mongoose.model("Permission", PermissionSchema);

// Daftar Permission Standar Aplikasi POS
const permissionsList = [
  { nama: "kelola-staff", deskripsi: "Dapat menambah, edit, hapus karyawan" },
  { nama: "kelola-produk", deskripsi: "Dapat mengatur menu dan harga" },
  { nama: "kelola-kategori", deskripsi: "Dapat mengatur kategori menu" },
  { nama: "kelola-bahan", deskripsi: "Dapat mengatur stok bahan baku" },
  { nama: "kelola-tenant", deskripsi: "Dapat mengubah profil toko" },
  { nama: "laporan-penjualan", deskripsi: "Dapat melihat omzet dan laporan" },
  { nama: "akses-pos", deskripsi: "Dapat melakukan transaksi kasir" },
];

const seedDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/db_produk"); // Sesuaikan URL DB Anda
    console.log("🔌 Terhubung ke MongoDB");

    // Hapus permission lama (opsional, biar bersih)
    await Permission.deleteMany({});
    console.log("🧹 Data Permission lama dibersihkan");

    // Masukkan data baru
    await Permission.insertMany(permissionsList);
    console.log("✅ Berhasil seeding Permission!");

    process.exit();
  } catch (err) {
    console.error("❌ Gagal seeding:", err);
    process.exit(1);
  }
};

seedDB();