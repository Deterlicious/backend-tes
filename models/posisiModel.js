const mongoose = require("mongoose");

const posisiSchema = new mongoose.Schema({
  namaPosisi: {
    type: String,
    required: true,
  },
  deskripsi: {
    type: String,
    required: true,
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  status: {
    type: String,
    enum: ["Aktif", "Non-Aktif"],
    default: "Aktif",
  },
});

module.exports = mongoose.model("Posisi", posisiSchema);