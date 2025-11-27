const mongoose = require("mongoose");

const tarifSchema = new mongoose.Schema({
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
  },
  durasiMinimum: {
    type: String,
    required: true,
  },
  tipeAsetID: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TipeAset",
      index: true,
    },
  ],
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
});

// index unik untuk mencegah duplikasi namaTarif dalam tenant yang sama
tarifSchema.index({ tenantID: 1, namaTarif: 1 }, { unique: true });

// index untuk optimasi pencarian berdasarkan namaTarif
tarifSchema.index({ namaTarif: 1 });

// index untuk optimasi pencarian berdasarkan tipeAsetID
tarifSchema.index({ tipeAsetID: 1 });

module.exports = mongoose.model("Tarif", tarifSchema);
