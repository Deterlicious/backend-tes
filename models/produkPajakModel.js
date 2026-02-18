const mongoose = require("mongoose");

const ProdukPajakSchema = new mongoose.Schema(
  {
    produkID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produk",
      required: [true, "ID Produk wajib diisi."],
      index: true,
    },
    pajakID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pajak",
      required: [true, "ID Pajak wajib diisi."],
    },
    // KOLOM BARU: Nama Pajak (Snapshot)
    namaPajak: {
      type: String,
      required: [true, "Nama pajak harus tercatat."],
      trim: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

// Mencegah duplikasi: Satu produk tidak boleh punya pajak yang sama dua kali
ProdukPajakSchema.index({ produkID: 1, pajakID: 1 }, { unique: true });

module.exports = mongoose.model("ProdukPajak", ProdukPajakSchema);
