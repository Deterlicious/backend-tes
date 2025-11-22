const mongoose = require("mongoose");

const kontrakKompensasiSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
    tipeGaji: {
      type: String,
      enum: ["Bulanan", "Harian", "Per-jam"],
      required: true,
    },
    tarifGaji: {
      type: Number,
      required: true,
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
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KontrakKompensasi", kontrakKompensasiSchema);