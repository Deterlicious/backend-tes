const mongoose = require('mongoose');

// Schema untuk subdokumen resep (embedded)
const ResepsSchema = new mongoose.Schema({
  bahanBakuID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BahanBaku',
    required: true
  },
  jumlah: {
    type: Number,
    required: true,
    min: 0
  },
  satuan: {
    type: String,
    enum: ['gram', 'ml', 'pcs', 'kg', 'liter'],
    required: true
  }
}, { _id: false });

// Schema utama Produk
const ProdukSchema = new mongoose.Schema({
  kodeProduk: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  namaProduk: {
    type: String,
    required: true,
    trim: true
  },
  gambarProduk: {
    type: String,
    default: null,
    trim: true
  },
  stok: {
    type: Number,
    default: 0,
    min: 0
  },
  hargaDasar: {
    type: Number,
    required: true,
    min: 0
  },
  hargaJual: {
    type: Number,
    required: true,
    min: 0
  },
  kategoriID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kategori',
    required: true
  },
  keterangan: {
    type: String,
    default: null
  },
  resep: {
    type: [ResepsSchema],
    default: []
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('Produk', ProdukSchema);
