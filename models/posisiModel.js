const mongoose = require("mongoose");

const posisiSchema = new mongoose.Schema(
  {
    namaPosisi: {
      type: String,
      required: true,
      trim: true,
    },
    deskripsi: {
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
    status: {
      type: String,
      enum: ["Aktif", "Non-Aktif"],
      default: "Aktif",
      index: true,
    },
  },
  { timestamps: true }
);

posisiSchema.index({ tenantID: 1, namaPosisi: 1 }, { unique: true });

module.exports = mongoose.model("Posisi", posisiSchema);