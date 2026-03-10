const { required } = require("joi");
const mongoose = require("mongoose");

// Sub-schema untuk Resep (Embedded)
const ResepSchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      required: true,
    },
    jumlah: {
      type: Number,
      required: true,
      min: [0, "Jumlah bahan tidak boleh negatif"],
    },
    satuan: {
      type: String,
      enum: ["gram", "ml", "pcs", "kg", "liter"],
      required: true,
    },
  },
  { _id: false },
);

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
      index: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    keterangan: {
      type: String,
      default: null,
    },
    resep: {
      type: [ResepSchema],
      default: [],
    },
    pajak: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pajak", // Pastikan nama model Pajak kamu sesuai
        index: true,
        required: false, // Pajak bisa kosong, jadi tidak wajib
      },
    ],
  },
  { timestamps: true },
);

// COMPOUND INDEX: Unique Name per Tenant
ProdukSchema.index({ tenantID: 1, namaProduk: 1 }, { unique: true });

// INDEX: Optimasi pencarian nama & filter kategori
ProdukSchema.index({ namaProduk: "text" }); // Text index untuk fitur search
ProdukSchema.index({ tenantID: 1, kategoriID: 1 }); // Filter umum di menu kasir

module.exports = mongoose.model("Produk", ProdukSchema);
