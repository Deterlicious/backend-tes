const mongoose = require("mongoose");

const KategoriBebanSchema = new mongoose.Schema(
  {
    namaKategori: {
      type: String,
      required: true,
      trim: true,
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
    versionKey: false,
  }
);

KategoriBebanSchema.index({ tenantID: 1, namaKategori: 1 }, { unique: true });

module.exports = mongoose.model("KategoriBeban", KategoriBebanSchema);