const mongoose = require("mongoose");

const absensiSchema = new mongoose.Schema(
  {
    tanggal: {
      type: Date,
      required: true,
      index: true, // Untuk filtering berdasarkan range tanggal
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
      type: Number,
      default: 0,
    },
    keterangan: {
      type: String,
      default: null,
      trim: true,
    },
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
      index: true, // Wajib index
    },
  },
  { timestamps: true }
);

// == Compound Indexes ==
// 1. Optimasi query: "Laporan absensi Tenant X diurutkan dari tanggal terbaru"
absensiSchema.index({ tenantID: 1, tanggal: -1 });

// 2. Optimasi query: "Riwayat absensi User X diurutkan dari tanggal terbaru"
absensiSchema.index({ penggunaID: 1, tanggal: -1 });

absensiSchema.pre("save", function (next) {
  if (this.waktuMasuk && this.waktuPulang) {
    const durasiMs = new Date(this.waktuPulang) - new Date(this.waktuMasuk);
    // Hitung jam (pembulatan 2 desimal agar lebih presisi daripada round int)
    this.durasiKerja = parseFloat((durasiMs / (1000 * 60 * 60)).toFixed(2));
  }
  next();
});

module.exports = mongoose.model("Absensi", absensiSchema);