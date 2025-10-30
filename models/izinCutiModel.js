const mongoose = require("mongoose");

const izinCutiSchema = new mongoose.Schema(
  {
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
    pengaju: {
      type: String, // nama pengguna yang mengajukan cuti
      required: true,
    },
    dicatatOleh: {
      type: String, // nama pengguna yang menyetujui / mencatat cuti
      required: false,
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
