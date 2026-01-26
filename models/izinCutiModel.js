const mongoose = require("mongoose");

const izinCutiSchema = new mongoose.Schema(
  {
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
      index: true,
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
      index: true,
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
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

izinCutiSchema.index({
  tenantID: 1,
  status: 1
});
izinCutiSchema.index({
  penggunaID: 1,
  tanggalMulai: -1
});

module.exports = mongoose.model("IzinCuti", izinCutiSchema);