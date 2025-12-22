const mongoose = require("mongoose");

const PelangganSchema = new mongoose.Schema(
  {
    namaPelanggan: {
      type: String,
      required: true,
      trim: true,
    },
    tipePelanggan: {
      type: String,
      enum: ["umum", "korporat", "member"],
      required: true,
      index: true,
    },
    nomorHp: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    alamat: {
      type: String,
      trim: true,
    },
    saldoPiutang: {
      type: Number,
      default: 0,
    },
    poinLoyalitas: {
      type: Number,
      default: 0,
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

PelangganSchema.index({ tenantID: 1, namaPelanggan: 1 }, { unique: true });

PelangganSchema.index(
  { tenantID: 1, nomorHp: 1 },
  {
    unique: true,
    partialFilterExpression: { nomorHp: { $type: "string" } },
  }
);

PelangganSchema.index(
  { tenantID: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);

module.exports = mongoose.model("Pelanggan", PelangganSchema);