const mongoose = require("mongoose");

const izinCutiSchema = new mongoose.Schema(
  {
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
      index: true, // Optimasi pencarian history per user
    },
    tanggalMulai: {
      type: Date,
      required: true,
    },
    tanggalSelesai: {
      type: Date,
      required: true,
    },
    tipe: {
      type: String,
      enum: ["sakit", "izin", "cuti tahunan"],
      required: true,
    },
    status: {
      type: String,
      enum: ["diajukan", "disetujui", "ditolak"],
      default: "diajukan",
      index: true, // Optimasi filter status (misal: cari yang pending)
    },
    keterangan: {
      type: String,
      required: true,
      trim: true,
    },
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      default: null,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true, // Wajib di-index untuk multi-tenancy
    },
  },
  { timestamps: true }
);

// == Compound Indexes ==
// Optimasi Query: "Tampilkan semua izin di tenant X yang statusnya Y"
izinCutiSchema.index({ tenantID: 1, status: 1 });

// Optimasi Query: "Tampilkan history izin user X diurutkan tanggal"
izinCutiSchema.index({ penggunaID: 1, tanggalMulai: -1 });

module.exports = mongoose.model("IzinCuti", izinCutiSchema);