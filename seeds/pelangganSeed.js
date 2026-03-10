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
  { nama: "kelola-pelanggan", grup: "Manajemen Pelanggan", deskripsi: "Dapat menambah, edit, hapus pelanggan" },
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