require("dotenv").config();
const mongoose = require("mongoose");
// Pastikan path model sesuai
const Permission = require("./models/permissionModel");

// Koneksi Database
const DB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk";

const masterPermissions = [
  // --- GRUP: DASHBOARD ---
  { nama: "lihat-dashboard", grup: "dashboard" }, // Akses halaman utama dashboard

  // --- GRUP: INVENTORI (PRODUK) ---
  { nama: "lihat-produk", grup: "inventori" },    // Melihat daftar produk
  { nama: "tambah-produk", grup: "inventori" },   // Menambah produk baru
  { nama: "ubah-produk", grup: "inventori" },     // Edit produk & stok
  { nama: "hapus-produk", grup: "inventori" },    // Menghapus produk

  // --- GRUP: INVENTORI (KATEGORI) ---
  { nama: "lihat-kategori", grup: "inventori" },
  { nama: "tambah-kategori", grup: "inventori" },
  { nama: "ubah-kategori", grup: "inventori" },
  { nama: "hapus-kategori", grup: "inventori" },

  // --- GRUP: INVENTORI (BAHAN BAKU) ---
  { nama: "lihat-bahan-baku", grup: "inventori" },
  { nama: "tambah-bahan-baku", grup: "inventori" },
  { nama: "ubah-bahan-baku", grup: "inventori" }, // Edit stok/satuan bahan
  { nama: "hapus-bahan-baku", grup: "inventori" },

  // --- GRUP: POINT OF SALE (KASIR) ---
  { nama: "akses-pos", grup: "penjualan" },          // Membuka menu POS
  { nama: "buat-transaksi-pos", grup: "penjualan" }, // Melakukan checkout/bayar di POS

  // --- GRUP: RIWAYAT PENJUALAN (BACK OFFICE) ---
  { nama: "lihat-riwayat-penjualan", grup: "penjualan" }, // Lihat list faktur
  { nama: "tambah-penjualan-manual", grup: "penjualan" }, // Input penjualan manual
  { nama: "ubah-penjualan", grup: "penjualan" },          // Edit data penjualan
  { nama: "hapus-penjualan", grup: "penjualan" },         // Hapus data penjualan

  // --- GRUP: PEMBELIAN (BELANJA STOK) ---
  { nama: "lihat-pembelian", grup: "pembelian" },
  { nama: "tambah-pembelian", grup: "pembelian" }, // Input belanja ke supplier
  { nama: "ubah-pembelian", grup: "pembelian" },
  { nama: "hapus-pembelian", grup: "pembelian" },

  // --- GRUP: AKUNTANSI (AKUN KAS) ---
  { nama: "lihat-akun-kas", grup: "akuntansi" },   // Lihat saldo kas/bank
  { nama: "tambah-akun-kas", grup: "akuntansi" },  // Buka rekening baru di sistem
  { nama: "ubah-akun-kas", grup: "akuntansi" },    // Edit nama/tipe akun
  { nama: "hapus-akun-kas", grup: "akuntansi" },

  // --- GRUP: MANAJEMEN TOKO (STAFF & DEVICE) ---
  { nama: "kelola-staff", grup: "setting" },            // CRUD User/Staff
  { nama: "lihat-riwayat-perangkat", grup: "setting" }, // Melihat device yang login
];

const seedPermissions = async () => {
  try {
    await mongoose.connect(DB_URI);
    console.log("✅ Terhubung ke MongoDB...");

    // 1. Hapus permission lama agar bersih (karena nama-namanya sudah berubah)
    await Permission.deleteMany({});
    console.log("🗑️  Data Permission lama dihapus.");

    // 2. Masukkan data baru
    await Permission.insertMany(masterPermissions);
    console.log("✅ Data Permission BARU berhasil ditambahkan!");
    console.log(`📊 Total: ${masterPermissions.length} permission.`);

  } catch (error) {
    console.error("❌ Gagal melakukan seeding:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔒 Koneksi ditutup.");
  }
};

seedPermissions();