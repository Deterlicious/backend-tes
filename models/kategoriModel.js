const mongoose = require("mongoose");

const kategoriSchema = new mongoose.Schema(
  {
    namaKategori: {
      type: String,
      required: true,
      trim: true,
    },
    kodeKategori: {
      type: String,
      required: true,
      trim: true,
    },
    keterangan: {
      type: String,
      default: null,
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

// COMPOUND INDEXES (Unique per Tenant)
// Mencegah duplikasi nama & kode hanya di dalam tenant yang sama
kategoriSchema.index({ tenantID: 1, namaKategori: 1 }, { unique: true });
kategoriSchema.index({ tenantID: 1, kodeKategori: 1 }, { unique: true });

module.exports = mongoose.model("Kategori", kategoriSchema);
