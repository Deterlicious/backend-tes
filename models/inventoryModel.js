const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      default: null,
    },
    barangInventoryID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BarangInventory",
      default: null,
    },
    locationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location", // Pastikan kamu punya model Lokasi (Gudang/Outlet)
      required: true,
    },
    stok: {
      type: Number,
      default: 0,
      min: 0,
    },
    stokMinimum: {
      type: Number,
      default: 0,
      min: 0,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

inventorySchema.pre("validate", function (next) {
  const hasBahanBaku = Boolean(this.bahanBakuID);
  const hasBarangInventory = Boolean(this.barangInventoryID);

  if (hasBahanBaku === hasBarangInventory) {
    this.invalidate(
      "item",
      "Inventory wajib memiliki salah satu: bahanBakuID atau barangInventoryID.",
    );
  }

  next();
});

// Index agar pencarian stok per lokasi cepat dan tidak ada item duplikat.
inventorySchema.index(
  { locationID: 1, bahanBakuID: 1 },
  {
    unique: true,
    partialFilterExpression: { bahanBakuID: { $type: "objectId" } },
  },
);
inventorySchema.index(
  { locationID: 1, barangInventoryID: 1 },
  {
    unique: true,
    partialFilterExpression: { barangInventoryID: { $type: "objectId" } },
  },
);

module.exports = mongoose.model("Inventory", inventorySchema);
