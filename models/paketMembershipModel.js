const mongoose = require('mongoose');

const PaketMembershipSchema = new mongoose.Schema({
  // paketMembershipID dihilangkan, menggunakan _id default MongoDB

  namaPaket: {
    type: String,
    required: [true, 'Nama paket wajib diisi.'],
    trim: true,
    unique: true // Nama paket biasanya unik per sistem atau per tenant
  },
  
  harga: {
    type: Number,
    required: [true, 'Harga paket wajib diisi.'],
    min: [0, 'Harga tidak boleh negatif.']
  },
  
  durasiHari: {
    type: Number,
    required: [true, 'Durasi hari wajib diisi.'],
    min: [1, 'Durasi hari harus minimal 1 hari.']
  },
  
  deskripsi: {
    type: String,
    default: null, // nullable
    trim: true,
  },
  
  status: {
    type: String,
    enum: {
        values: ['Aktif', 'Non-Aktif'],
        message: '{VALUE} bukan status yang valid. Pilih salah satu: Aktif atau Non-Aktif.'
    },
    default: 'Aktif',
    required: [true, 'Status paket wajib diisi.'],
  },
  
  // FK: Referensi ke Tenant
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant', 
    required: [true, 'Tenant ID wajib diisi.'],
  },
}, {
  timestamps: true,
  versionKey: false,
});

const PaketMembership = mongoose.model('PaketMembership', PaketMembershipSchema);

module.exports = PaketMembership;