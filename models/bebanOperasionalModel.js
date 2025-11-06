const mongoose = require('mongoose');

const BebanOperasionalSchema = new mongoose.Schema({
  // bebanOperasionalID dihilangkan, menggunakan _id default MongoDB

  // FK: Akun Kas (dari mana dana dikeluarkan)
  akunKasID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AkunKas', 
    required: true,
  },
  
  // FK: Kategori Beban
  kategoriBebanID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KategoriBeban', // Asumsi nama model adalah 'KategoriBeban'
    required: true,
  },
  
  tanggal: {
    type: Date,
    required: true,
  },
  
  jumlah: {
    type: Number,
    required: true,
    min: 0,
  },
  
  keterangan: {
    type: String,
    required: true,
    trim: true,
  },

  // FK: Dicatat oleh User atau Staff
  dicatatOleh: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pengguna', // Asumsi nama model user/staff adalah 'User'
    required: true,
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

const BebanOperasional = mongoose.model('BebanOperasional', BebanOperasionalSchema);

module.exports = BebanOperasional;