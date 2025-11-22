const mongoose = require('mongoose');

const PelangganSchema = new mongoose.Schema({
  // pelangganID dihilangkan, menggunakan _id default MongoDB

  namaPelanggan: {
    type: String,
    required: [true, 'Nama pelanggan wajib diisi.'],
    trim: true,
  },
  
  tipePelanggan: {
    type: String,
    enum: {
        values: ['umum', 'korporat', 'member'],
        message: '{VALUE} bukan tipe pelanggan yang valid. Pilih salah satu: umum, korporat, atau member.'
    },
    required: [true, 'Tipe pelanggan wajib diisi.'],
  },
  
  nomorHp: {
    type: String,
    default: null, // nullable
    trim: true,
  },
  
  email: {
    type: String,
    default: null, // nullable
    trim: true,
    // Validator untuk format email yang benar (opsional)
    // match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g, 'Format email tidak valid.'] 
  },
  
  alamat: {
    type: String,
    default: null, // nullable
    trim: true,
  },
  
  saldoPiutang: {
    type: Number,
    default: 0,
    min: [0, 'Saldo Piutang tidak boleh negatif.']
  },
  
  poinLoyalitas: {
    type: Number,
    default: 0,
    min: [0, 'Poin Loyalitas tidak boleh negatif.']
  },
  
  // FK: Referensi ke Tenant (Wajib untuk data scoping)
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant', 
    required: [true, 'Tenant ID wajib diisi.'],
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Pelanggan = mongoose.model('Pelanggan', PelangganSchema);

module.exports = Pelanggan;