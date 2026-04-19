const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      required: true,
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

// Index agar pencarian stok per lokasi cepat
inventorySchema.index({ locationID: 1, bahanBakuID: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", inventorySchema);
