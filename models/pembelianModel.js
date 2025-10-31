const mongoose = require('mongoose');

// === Subdokumen untuk items ===
const ItemSchema = new mongoose.Schema({
  BahanBakuID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BahanBaku',
    required: true
  },
  jumlahStok: {
    type: Number,
    required: true,
    min: 1
  },
  satuan: {
    type: String,
    enum: ['kg', 'liter', 'pcs', 'pak', 'meter'],
    required: true
  },
  hargaBeli: {
    type: Number,
    default: 0
  }
}, { _id: false });

// === Schema utama Pembelian ===
const PembelianSchema = new mongoose.Schema({
  tanggal: {
    type: Date,
    required: true,
    default: Date.now
  },
  akunKasID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AkunKas',
    required: true
  },
  totalBiaya: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: String,
    required: true,
    trim: true
  },
  keterangan: {
    type: String,
    required: true,
    trim: true
  },
  items: [ItemSchema],
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

const Pembelian = mongoose.model('Pembelian', PembelianSchema);
module.exports = Pembelian;
