const mongoose = require("mongoose");

const tarifSchema = new mongoose.Schema(
  {
    namaTarif: {
      type: String,
      required: true,
      trim: true,
    },
    basisPerhitungan: {
      type: String,
      enum: ["per jam", "per sesi"],
      required: true,
    },
    harga: {
      type: Number,
      required: true,
      min: 0,
    },
    durasiMinimum: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    hariAktif: {
      type: [Number],
      enum: [0, 1, 2, 3, 4, 5, 6],
      default: [],
    },
    jamMulai: {
      type: String,
      default: "00:00",
      trim: true,
    },
    jamSelesai: {
      type: String,
      default: "23:59",
      trim: true,
    },
    prioritas: {
      type: Number,
      default: 1,
    },
    tipeAsetID: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TipeAset",
      },
    ],
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

tarifSchema.index({ tenantID: 1, namaTarif: 1 }, { unique: true });
tarifSchema.index({ tipeAsetID: 1 });
tarifSchema.index({ tenantID: 1, isActive: 1 });
tarifSchema.index({ tenantID: 1, prioritas: -1 });

module.exports = mongoose.model("Tarif", tarifSchema);
