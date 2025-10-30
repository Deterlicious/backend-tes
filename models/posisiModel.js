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
});

module.exports = mongoose.model("Posisi", posisiSchema);
