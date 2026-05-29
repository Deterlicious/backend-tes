const mongoose = require("mongoose");

const BarangInventorySchema = new mongoose.Schema(
  {
    namaBarang: {
      type: String,
      required: [true, "Nama barang wajib diisi."],
      trim: true,
    },
    tipe: {
      type: String,
      enum: ["ALAT_DAPUR", "PERLENGKAPAN", "KEMASAN", "KEBERSIHAN", "LAINNYA"],
      required: [true, "Tipe barang wajib diisi."],
    },
    satuan: {
      type: String,
      required: [true, "Satuan barang wajib diisi."],
      enum: ["kg", "gram", "liter", "ml", "pcs", "pak", "unit"],
    },
    deskripsi: { type: String, trim: true },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

BarangInventorySchema.index(
  { tenantID: 1, namaBarang: 1 },
  { unique: true },
);

module.exports = mongoose.model("BarangInventory", BarangInventorySchema);
