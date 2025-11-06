const mongoose = require('mongoose');

const JurnalTransferSchema = new mongoose.Schema({
  // jurnalTransferID dihilangkan, menggunakan _id default MongoDB

  tanggal: {
    type: Date,
    required: true,
  },
  
  // FK: Kas Sumber (Akun dari mana uang keluar)
  kasSumberID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AkunKas', // Asumsi nama model Kas adalah 'AkunKas'
    required: true,
  },
  
  // FK: Kas Tujuan (Akun ke mana uang masuk)
  kasTujuanID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AkunKas', 
    required: true,
  },
  
  jumlah: {
    type: Number,
    required: true,
    min: 1, // Jumlah harus positif
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

const JurnalTransfer = mongoose.model('JurnalTransfer', JurnalTransferSchema);

module.exports = JurnalTransfer;