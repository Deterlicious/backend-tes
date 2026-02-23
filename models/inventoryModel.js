const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema({
  bahanBakuID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BahanBaku",
    required: true,
  },

  // RELASI 2: "Di Mana?"
  // Ini kunci pemisah antara stok Gudang dan Stok Outlet
  locationID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location", // Tabel baru (Master Lokasi)
    required: true,
  },

  // DATA UTAMA: Jumlah Stok Fisik di lokasi tersebut
  stok: {
    type: Number,
    default: 0,
    min: 0,
    required: [true, "Stok harus diisi dan tidak boleh negatif."],
  },

  // Identitas Tenant
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
});

// INDEX PENTING:
// Mencegah duplikasi: Satu bahan baku hanya boleh punya 1 entry per lokasi.
InventorySchema.index({ bahanBakuID: 1, locationID: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", InventorySchema);
