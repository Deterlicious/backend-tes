const mongoose = require("mongoose");

const posisiSchema = new mongoose.Schema({
  namaPosisi: {
    type: String,
    required: true,
    trim: true,
  },
  deskripsi: {
    type: String,
    required: true,
    trim: true,
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true, // Index untuk filtering per tenant
  },
  status: {
    type: String,
    enum: ["Aktif", "Non-Aktif"],
    default: "Aktif",
    index: true, // Index status
  },
});

// == Compound Indexes ==
// 1. Mencegah duplikasi nama posisi dalam satu tenant (Misal: tidak boleh ada 2 "Manager" di tenant A)
posisiSchema.index({ tenantID: 1, namaPosisi: 1 }, { unique: true });

module.exports = mongoose.model("Posisi", posisiSchema);