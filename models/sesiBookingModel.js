const mongoose = require("mongoose");

const sesiBookingSchema = new mongoose.Schema(
  {
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: true,
    },
    asetID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aset",
      required: true,
    },
    waktuMulai: {
      type: Date,
      required: true,
    },
    waktuSelesai: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Aktif", "Selesai", "Batal"],
      default: "Aktif",
    },
    durasiMenit: {
      type: Number,
      default: null,
    },
    totalBiaya: {
      type: Number,
      default: null,
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SesiBooking", sesiBookingSchema);