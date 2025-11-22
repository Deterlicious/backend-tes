const mongoose = require("mongoose");

const izinCutiSchema = new mongoose.Schema(
  {
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
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
    },
    keterangan: {
      type: String,
      required: true,
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
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IzinCuti", izinCutiSchema);