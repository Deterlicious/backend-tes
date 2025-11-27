const mongoose = require("mongoose");

const asetSchema = new mongoose.Schema(
  {
    namaAset: {
      type: String,
      required: true,
    },
    tipeAsetID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TipeAset",
      index: true,
    },
    status: {
      type: String,
      enum: ["tersedia", "digunakan", "perbaikan"],
      default: "tersedia",
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Aset", asetSchema);