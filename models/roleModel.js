const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true, // Index untuk filtering
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

// == Compound Index & Unique Constraint ==
// Mencegah duplikasi nama role dalam satu tenant.
// Contoh: Tenant A tidak boleh punya dua role bernama "Kasir".
roleSchema.index({ tenantID: 1, namaRole: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);