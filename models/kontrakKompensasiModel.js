const mongoose = require("mongoose");

const kontrakKompensasiSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
      index: true,
    },
    tipeGaji: {
      type: String,
      enum: ["Bulanan", "Harian", "Per-jam"],
      required: true,
    },
    tarifGaji: {
      type: Number,
      required: true,
      min: 0,
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

kontrakKompensasiSchema.index({ tenantID: 1, status: 1 });

module.exports = mongoose.model("KontrakKompensasi", kontrakKompensasiSchema);