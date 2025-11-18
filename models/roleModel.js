const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  namaRole: {
    type: String,
    required: true,
  },
  deskripsi: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Role", roleSchema);