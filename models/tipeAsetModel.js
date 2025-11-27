const mongoose = require("mongoose");

const tipeAsetSchema = new mongoose.Schema({
  namaTipeAset: {
    type: String,
    required: true,
    trim: true,
  },
  deskripsi: {
    type: String,
    default: null,
  },

  // ambil _id default dari koleksi Tarif
  tipeAsetID: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tarif",
      index: true,
    },
  ],

  // ambil _id default dari koleksi Tenant
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
});

// index unik untuk mencegah duplikasi namaTipeAset dalam tenant yang sama
tipeAsetSchema.index({ tenantID: 1, namaTipeAset: 1 }, { unique: true });

// index untuk optimasi pencarian berdasarkan namaTipeAset
tipeAsetSchema.index({ namaTipeAset: 1 });

module.exports = mongoose.model("TipeAset", tipeAsetSchema);
