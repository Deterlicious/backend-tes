const mongoose = require("mongoose");

// Schema untuk subdokumen resep (embedded)
const ResepsSchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      required: true,
    },
    jumlah: {
      type: Number,
      required: true,
      min: 0,
    },
    satuan: {
      type: String,
      enum: ["gram", "ml", "pcs", "kg", "liter"],
      required: true,
    },
  },
  { _id: false }
);

// Schema utama Produk
const ProdukSchema = new mongoose.Schema(
  {
    namaProduk: {
      type: String,
      required: true,
      trim: true,
    },
    gambarProduk: {
      type: String,
      default: null,
      trim: true,
    },
    stok: {
      type: Number,
      default: 0,
      min: 0,
    },
    hargaDasar: {
      type: Number,
      required: true,
      min: 0,
    },
    hargaJual: {
      type: Number,
      required: true,
      min: 0,
    },
    kategoriID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kategori",
      required: true,
      // Tambahkan index untuk optimasi pencarian berdasarkan kategoriID
      index: true,
    },
    keterangan: {
      type: String,
      default: null,
    },
    resep: {
      type: [ResepsSchema],
      default: [],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      // Tambahkan index untuk optimasi pencarian berdasarkan tenantID
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integrity): Mencegah duplikasi namaProduk dalam tenant yang sama.
ProdukSchema.index({ tenantID: 1, namaProduk: 1 }, { unique: true });

// 2. Index Single Field (Optimasi Pencarian): Untuk pencarian global atau filter cepat.
ProdukSchema.index({ namaProduk: 1 });

// 3. Index Field FK (Optimasi Join/Filter): KategoriID sudah ditambahkan di definisi field.
// Jika Anda sering mencari berdasarkan harga, Anda juga bisa menambahkan:
// ProdukSchema.index({ hargaJual: 1 });

// --------------------------------------------------

module.exports = mongoose.model("Produk", ProdukSchema);
