const mongoose = require('mongoose');

// Schema untuk itemPenjualan
const ItemPenjualanSchema = new mongoose.Schema({
  produkID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Produk',
    required: true
  },
  jumlah: {
    type: Number,
    required: true
  },
  hargaSatuan: {
    type: Number,
    required: true
  },
  subTotal: {
    type: Number,
    required: true
  }
}, { _id: false });

// Schema utama penjualan
const PenjualanSchema = new mongoose.Schema({
  tanggalPenjualan: {
    type: Date,
    required: true
  },
  nomorFaktur: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  totalHarga: {
    type: Number,
    required: true
  },
  namaPelanggan: {
    type: String,
    default: null
  },
  itemPenjualan: {
    type: [ItemPenjualanSchema],
    required: true
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  statusPembayaran: {
    type: String,
    enum: ['UNPAID', 'PARTIAL', 'PAID'],
    default: 'UNPAID'
  },
  sisaTagihan: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Penjualan', PenjualanSchema);
