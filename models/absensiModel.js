const mongoose = require("mongoose");

const absensiSchema = new mongoose.Schema({
  tanggal: {
    type: Date,
    required: true,
  },
  waktuMasuk: {
    type: Date,
    required: true,
  },
  fotoMasuk: {
    type: String,
    required: true,
  },
  waktuPulang: {
    type: Date,
    required: true,
  },
  fotoPulang: {
    type: String,
    required: true,
  },
  durasiKerja: {
    type: Number, // dalam jam atau menit (bisa dihitung otomatis di controller)
    default: 0,
  },
  keterangan: {
    type: String,
    default: null,
  },
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
});

// 🧮 Hitung durasi kerja otomatis sebelum save
absensiSchema.pre("save", function (next) {
  if (this.waktuMasuk && this.waktuPulang) {
    const durasiMs = this.waktuPulang - this.waktuMasuk;
    this.durasiKerja = Math.round(durasiMs / (1000 * 60 * 60)); // jam
  }
  next();
});

module.exports = mongoose.model("Absensi", absensiSchema);
