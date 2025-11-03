const mongoose = require("mongoose");

const kategoriSchema = new mongoose.Schema({
  namaKategori: {
    type: String,
    required: true,
    trim: true
  },
  kodeKategori: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  keterangan: {
    type: String,
    default: null
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant", // asumsi kamu punya model Tenant
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Kategori", kategoriSchema);
