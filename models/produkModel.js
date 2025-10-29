// models/Produk.js
const mongoose = require("mongoose");

const ProdukSchema = new mongoose.Schema(
  {
    produkID: {
      type: String,
      required: true,
      trim: true,
    },
    namaProduk: {
      type: String,
      required: true,
      trim: true,
    },
    stok: {
      type: Number,
      default: 0,
      min: 0,
    },
    hargaDasar: {
      type: Number,
      default: 0,
      min: 0,
    },
    hargaJual: {
      type: Number,
      default: 0,
      min: 0,
    },
    kategoriID: {
      type: mongoose.Schema.Types.String, // relasi ke koleksi lain, bisa diubah ke ObjectId jika pakai ref
      ref: "Kategori",
      default: null,
    },
    keterangan: {
      type: String,
      default: null,
      required: false,
    },
    // 🆕 Tambahkan field gambar
    gambar: {
      type: String,
      default: null, // boleh kosong/null
      required: false, // tidak wajib diisi
      trim: true, // bersihkan spasi di awal/akhir
    }
  },
  {
    timestamps: true, // otomatis menambahkan createdAt dan updatedAt
    versionKey: false, // menghilangkan __v
  }
);

// Membuat indeks unik untuk kodeProduk agar tidak duplikat
ProdukSchema.index({ produkID: 1 }, { unique: true });

const Produk = mongoose.model("Produk", ProdukSchema);

module.exports = Produk;
