const mongoose = require("mongoose");

const asetSchema = new mongoose.Schema(
  {
    namaAset: {
      type: String,
      required: true,
      trim: true,
    },
    tipeAsetID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TipeAset",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["tersedia", "digunakan", "perbaikan"],
      default: "tersedia",
      index: true,
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

asetSchema.index({
  tenantID: 1,
  status: 1
});
asetSchema.index({
  tenantID: 1,
  namaAset: 1
});

module.exports = mongoose.model("Aset", asetSchema);