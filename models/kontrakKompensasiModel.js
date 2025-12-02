const mongoose = require("mongoose");

const kontrakKompensasiSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true, // Wajib index
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
      index: true, // Wajib index (History gaji user)
    },
    tipeGaji: {
      type: String,
      enum: ["Bulanan", "Harian", "Per-jam"],
      required: true,
    },
    tarifGaji: {
      type: Number,
      required: true,
      min: 0, // Validasi level Schema
    },
    tanggalMulai: {
      type: Date,
      required: true,
    },
    tanggalSelesai: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Aktif", "Berakhir"],
      default: "Aktif",
      index: true,
    },
  },
  { timestamps: true }
);

// == Compound Indexes ==
// Optimasi Query: "Cari semua kontrak AKTIF di tenant X"
kontrakKompensasiSchema.index({ tenantID: 1, status: 1 });

module.exports = mongoose.model("KontrakKompensasi", kontrakKompensasiSchema);