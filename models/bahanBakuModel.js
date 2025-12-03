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
    satuan: {
      type: String,
      required: true,
      enum: ["kg", "gram", "liter", "ml", "pcs", "pak", "unit"],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// COMPOUND INDEX: Unik per tenant
bahanBakuSchema.index({ tenantID: 1, namaBahan: 1 }, { unique: true });

module.exports = mongoose.model("BahanBaku", bahanBakuSchema);
