const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema({
  namaToko: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["aktif", "non-aktif"],
    default: "aktif",
  },
  alamat: {
    type: String,
    default: null,
  },
  kota: {
    type: String,
    default: null,
  },
  kodePos: {
    type: String,
    default: null,
  },
  nomorTelepon: {
    type: String,
    default: null,
  },
  emailBisnis: {
    type: String,
    default: null,
  },
  logoUrl: {
    type: String,
    default: null,
  },
  footerStruk: {
    type: String,
    default: null,
  },
  idNPWP: {
    type: String,
    default: null,
  },
  persenPajak: {
    type: Number,
    default: 0,
  },
  tipePajak: {
    type: String,
    enum: ["Sudah Termasuk (Inclusive)", "Belum Termasuk (Exclusive)"],
    default: "Sudah Termasuk (Inclusive)",
  },
  isSetupComplete: {
    type: Boolean,
    required: true,
    default: false,
  },
});

module.exports = mongoose.model("Tenant", tenantSchema);