const mongoose = require("mongoose");

const absensiSchema = new mongoose.Schema(
  {
    tanggal: {
      type: Date,
      required: true,
      index: true,
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
      index: true,
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

absensiSchema.index({
  tenantID: 1,
  tanggal: -1
});
absensiSchema.index({
  penggunaID: 1,
  tanggal: -1
});

absensiSchema.pre("save", function (next) {
  if (this.waktuMasuk && this.waktuPulang) {
    const durasiMs = new Date(this.waktuPulang) - new Date(this.waktuMasuk);
    this.durasiKerja = parseFloat((durasiMs / (1000 * 60 * 60)).toFixed(2));
  }
  next();
});

module.exports = mongoose.model("Absensi", absensiSchema);