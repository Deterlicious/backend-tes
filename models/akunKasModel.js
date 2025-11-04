const mongoose = require('mongoose');

const AkunKasSchema = new mongoose.Schema({
  namaAkun: {
    type: String,
    required: true,
    trim: true
  },
  saldo: {
    type: Number,
    required: true,
    default: 0, // Saldo awal bisa kita default ke 0
    min: 0
  },
  tipeAkun: {
    type: String,
    enum: ['Kas Fisik', 'Rekening Bank'], // Ubah agar lebih rapi
    required: true
  },
  status: {
    type: String,
    enum: ['aktif', 'non-aktif'],
    default: 'aktif'
  },
  nomorAkun: {
    type: String,
    required: true,
    trim: true,
    unique: true // Nomor akun biasanya unik
  },
  keterangan: {
    type: String,
    default: null
  },
  // Wajib menyertakan tenantID untuk konsistensi data scope
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant', // Sesuaikan dengan nama model Tenant Anda
    required: true // Dibuat wajib agar setiap akun terikat pada satu tenant
  }
}, {
  timestamps: true,
  versionKey: false
});

const AkunKas = mongoose.model('AkunKas', AkunKasSchema);

module.exports = AkunKas;