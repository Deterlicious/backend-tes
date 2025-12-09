const mongoose = require("mongoose");

const tipeAsetSchema = new mongoose.Schema(
  {
    namaTipeAset: {
      type: String,
      required: true,
      trim: true,
    },
    deskripsi: {
      type: String,
      default: null,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true }, // PENTING: Agar virtual muncul saat res.json()
    toObject: { virtuals: true }
  }
);

// == VIRTUAL POPULATE ==
// Definisi: "Field 'listTarif' ini isinya diambil dari tabel 'Tarif', 
// dimana field 'tipeAsetID' di sana cocok dengan '_id' saya di sini."
tipeAsetSchema.virtual("listTarif", {
  ref: "Tarif",           // Model yang mau diintip
  localField: "_id",      // ID (TipeAset)
  foreignField: "tipeAsetID", // Field di seberang (Tarif) yang menyimpan ID
  justOne: false          // Karena satu tipe aset bisa punya banyak tarif
});

tipeAsetSchema.index({ tenantID: 1, namaTipeAset: 1 }, { unique: true });

module.exports = mongoose.model("TipeAset", tipeAsetSchema);