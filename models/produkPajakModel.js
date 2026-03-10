const mongoose = require("mongoose");

const ProdukPajakSchema = new mongoose.Schema(
  {
    produkID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produk",
      default: null,
      index: true,
    },
    assetID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      default: null,
      index: true,
    },
    pajakID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pajak",
      required: true,
      index: true,
    },
    namaPajak: {
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

ProdukPajakSchema.index(
  { tenantID: 1, produkID: 1, pajakID: 1 },
  {
    unique: true,
    partialFilterExpression: { produkID: { $type: "objectId" } },
  }
);

ProdukPajakSchema.index(
  { tenantID: 1, assetID: 1, pajakID: 1 },
  {
    unique: true,
    partialFilterExpression: { assetID: { $type: "objectId" } },
  }
);

module.exports =
  mongoose.models.ProdukPajak ||
  mongoose.model("ProdukPajak", ProdukPajakSchema);