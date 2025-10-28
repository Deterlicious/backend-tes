const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema({
  namaToko: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["aktif", "non-aktif"],
    default: "aktif",
  },
  alamat: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Tenant", tenantSchema);
