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
});

// COMPOUND INDEX: Unik per Tenant
// Mencegah duplikasi nama role (misal: "Kasir") di tenant yang sama
roleSchema.index({ tenantID: 1, namaRole: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);