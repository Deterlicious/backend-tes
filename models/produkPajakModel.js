const mongoose = require("mongoose");

const ProdukPajakSchema = new mongoose.Schema(
  {
    produkID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produk",
      default: null,
    },
    asset_ID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      default: null,
    }, // Tambahan field revisi
    pajakID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pajak",
      required: true,
    },
    nama_pajak: { type: String, required: true },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("ProdukPajak", ProdukPajakSchema);
