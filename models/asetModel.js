const mongoose = require("mongoose");

const asetSchema = new mongoose.Schema(
  {
    namaAset: {
      type: String,
      required: true,
      trim: true,
    },
    tipeAsetID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TipeAset",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["tersedia", "digunakan", "perbaikan"],
      default: "tersedia",
      index: true, // Index status untuk filtering cepat
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

// == Compound Indexes ==
// Optimasi query: "Tampilkan semua aset milik Tenant X yang statusnya Y"
asetSchema.index({ tenantID: 1, status: 1 });

// Optimasi query: "Cari nama aset berdasarkan abjad di dalam Tenant X"
asetSchema.index({ tenantID: 1, namaAset: 1 });

module.exports = mongoose.model("Aset", asetSchema);