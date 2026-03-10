const mongoose = require("mongoose");

const tipeAsetSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    namaTipeAset: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    deskripsi: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tipeAsetSchema.virtual("listTarif", {
  ref: "Tarif",
  localField: "_id",
  foreignField: "tipeAsetID",
  justOne: false,
});

tipeAsetSchema.index({ tenantID: 1, namaTipeAset: 1 }, { unique: true });

module.exports =
  mongoose.models.TipeAset || mongoose.model("TipeAset", tipeAsetSchema);