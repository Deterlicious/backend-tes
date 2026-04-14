const mongoose = require("mongoose");

const PermintaanStokSchema = new mongoose.Schema(
  {
    nomorRequest: { type: String, required: true, unique: true },
    dariLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    keLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PENDING",
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
        "COMPLETED",
      ],
      default: "DRAFT",
    },
    items: [
      {
        bahanBakuID: { type: mongoose.Schema.Types.ObjectId, ref: "BahanBaku" },
        jumlah: { type: Number, required: true },
      },
    ],
    dimintaOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
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

module.exports = mongoose.model("PermintaanStok", PermintaanStokSchema);
