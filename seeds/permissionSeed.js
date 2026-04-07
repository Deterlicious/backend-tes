require("dotenv").config();
const mongoose = require("mongoose");

// Definisi Model Inline (Saya update agar sesuai dengan Model Asli)
const PermissionSchema = new mongoose.Schema({
  nama: { type: String, required: true, unique: true },
  grup: { type: String, required: true }, // <--- FIELD WAJIB DITAMBAHKAN
  deskripsi: String,
});

// Cek apakah model sudah ada compile sebelumnya untuk menghindari OverwriteModelError
const Permission = mongoose.models.Permission || mongoose.model("Permission", PermissionSchema);

// Daftar Permission (Lengkap dengan Grup)
const permissionsList = [
  // Grup: Staff
  { nama: "kelola-staff", grup: "Manajemen Staff", deskripsi: "Dapat menambah, edit, hapus karyawan" },
  { nama: "kelola-pelanggan", grup: "Manajemen Pelanggan", deskripsi: "Dapat menambah, edit, hapus pelanggan" },
  
  // Grup: Produk
  { nama: "kelola-produk", grup: "Manajemen Produk", deskripsi: "Dapat mengatur menu dan harga" },
  { nama: "kelola-kategori", grup: "Manajemen Produk",  deskripsi: "Dapat mengatur kategori menu" },
  { nama: "kelola-bahan", grup: "Manajemen Produk", deskripsi: "Dapat mengatur stok bahan baku" },
  
  // Grup: Toko
  { nama: "kelola-tenant", grup: "Pengaturan Toko", deskripsi: "Dapat mengubah profil toko" },
  { nama: "kelola-akunkas", grup: "Pengaturan Toko", deskripsi: "Dapat menambah, edit, hapus akun kasir" },
  { nama: "kelola-metode-pembayaran", grup: "Pengaturan Toko", deskripsi: "Dapat menambah, edit, hapus metode pembayaran" },
  { nama: "kelola-pembayaran", grup: "Pengaturan Toko", deskripsi: "Dapat menambah, edit, hapus pembayaran" },
  
  // Grup: Laporan
  { nama: "laporan-penjualan", grup: "Laporan", deskripsi: "Dapat melihat omzet dan laporan" },
  
  // Grup: POS
  { nama: "akses-pos", grup: "Transaksi", deskripsi: "Dapat melakukan transaksi kasir" },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk");
    console.log("🔌 Terhubung ke MongoDB");

    // Hapus permission lama
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