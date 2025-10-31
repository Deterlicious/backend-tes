const mongoose = require('mongoose');

const AkunKasSchema = new mongoose.Schema({
  akunKasID: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  namaAkun: {
    type: String,
    required: true,
    trim: true
  },
  saldo: {
    type: Number,
    required: true,
    min: 0
  },
  tipeAkun: {
    type: String,
    enum: ['kas fisik', 'Rekening Bank'],
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
    trim: true
  },
  keterangan: {
    type: String,
    default: null
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: false
  }
}, {
  timestamps: true,
  versionKey: false
});

const AkunKas = mongoose.model('AkunKas', AkunKasSchema);

module.exports = AkunKas;
