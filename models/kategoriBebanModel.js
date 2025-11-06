const mongoose = require('mongoose');

const KategoriBebanSchema = new mongoose.Schema({
  // kategoriBebanID dihilangkan, menggunakan _id default MongoDB

  namaKategori: {
    type: String,
    required: true,
    trim: true,
    unique: true // Nama kategori biasanya unik (setidaknya per tenant, validasi bisa di controller)
  },
  
  // FK: Referensi ke Tenant (Wajib untuk data scoping)
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant', // Asumsi nama model adalah 'Tenant'
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const KategoriBeban = mongoose.model('KategoriBeban', KategoriBebanSchema);

module.exports = KategoriBeban;