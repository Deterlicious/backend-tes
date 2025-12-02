const mongoose = require("mongoose");

const BahanBakuSchema = new mongoose.Schema(
  {
    namaBahan: {
      type: String,
      // Tambahkan pesan error kustom
      required: [true, "Nama bahan baku wajib diisi."],
      trim: true,
    },
    stok: {
      type: Number,
      default: 0,
      // Tambahkan pesan error kustom
      min: [0, "Stok tidak boleh bernilai negatif."],
    },
    satuan: {
      type: String,
      // Tambahkan pesan error kustom
      required: [true, "Satuan wajib diisi."],
      enum: {
        values: ["kg", "gram", "liter", "ml", "pcs", "pak", "unit"],
        message:
          "{VALUE} bukan satuan yang valid. Pilih salah satu: kg, gram, liter, ml, pcs, pak, atau unit.",
      },
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      // Tambahkan pesan error kustom
      required: [true, "Tenant ID wajib diisi."],
      // Index sudah diatur di luar (compound index)
    },
  },
  {
    timestamps: true,
    versionKey: false, // Konsisten dengan model lain
  }
);

// Index unik untuk kombinasi tenant dan nama bahan (Sudah Bagus!)
BahanBakuSchema.index({ tenantID: 1, namaBahan: 1 }, { unique: true });

const BahanBaku = mongoose.model("BahanBaku", BahanBakuSchema);

module.exports = BahanBaku;
