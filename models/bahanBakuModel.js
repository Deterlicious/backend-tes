const mongoose = require("mongoose");

const BahanBakuSchema = new mongoose.Schema(
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
      enum: ["kg", "gram", "liter", "ml", "pcs", "pak", "unit"], // kamu bisa ubah sesuai kebutuhan
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index unik untuk kombinasi tenant dan nama bahan
BahanBakuSchema.index({ tenantID: 1, namaBahan: 1 }, { unique: true });

const BahanBaku = mongoose.model("BahanBaku", BahanBakuSchema);

module.exports = BahanBaku;
