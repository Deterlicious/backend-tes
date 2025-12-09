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
      type: Number, // Ubah ke Number agar bisa dihitung matematis
      required: true,
      min: 1,
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
  { timestamps: true }
);

// Compound Index: Nama unik per tenant
tarifSchema.index({ tenantID: 1, namaTarif: 1 }, { unique: true });

// Index tipeAsetID untuk pencarian cepat (Misal: Cari semua tarif untuk PS5)
tarifSchema.index({ tipeAsetID: 1 });

module.exports = mongoose.model("Tarif", tarifSchema);