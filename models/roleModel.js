const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  namaRole: {
    type: String,
    required: true,
    trim: true,
  },
  deskripsi: {
    type: String,
    default: null,
    trim: true,
  },
  // 🔥 KEMBALI KE ARRAY:
  permissions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
    },
  ],
});

// Tetap gunakan unique per tenant agar tidak bentrok
roleSchema.index({ tenantID: 1, namaRole: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);