const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema(
  {
    nama: {
      type: String,
      required: [true, "Nama lokasi wajib diisi."],
      trim: true,
    },
    tipe: {
      type: String,
      enum: ["Outlet", "Gudang"],
      required: [true, "Tipe lokasi (Outlet/Gudang) wajib diisi."],
    },
    alamat: {
      type: String,
      required: [true, "Alamat lokasi wajib diisi."],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Location", LocationSchema);
