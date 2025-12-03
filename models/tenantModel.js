const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    namaToko: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["aktif", "non-aktif"],
      default: "aktif",
      index: true, // Index untuk filter tenant aktif
    },
    alamat: {
      type: String,
      default: null,
      trim: true,
    },
    kota: {
      type: String,
      default: null,
      trim: true,
    },
    kodePos: {
      type: String,
      default: null,
      trim: true,
    },
    nomorTelepon: {
      type: String,
      default: null,
      trim: true,
    },
    emailBisnis: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
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
      min: 0,
      max: 100, // Validasi level Schema
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tenant", tenantSchema);
