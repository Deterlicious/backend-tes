const mongoose = require("mongoose");

const bahanBakuSchema = new mongoose.Schema(
  {
    namaBahan: {
      type: String,
      required: true,
      trim: true,
    },
    stok: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimalStok: {
      type: Number,
      default: 0,
      min: [0, "Minimal stok tidak boleh negatif"],
    },
    satuan: {
      type: String,
      required: [true, "Isi seperti kg, gram, liter, ml, pcs, pak, unit."],
      enum: ["kg", "gram", "liter", "ml", "pcs", "pak", "unit"],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

bahanBakuSchema.index({ tenantID: 1, namaBahan: 1 }, { unique: true });

module.exports = mongoose.model("BahanBaku", bahanBakuSchema);
