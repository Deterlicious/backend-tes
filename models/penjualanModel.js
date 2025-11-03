const mongoose = require('mongoose');

// Subschema untuk ItemPenjualan
const ItemPenjualanSchema = new mongoose.Schema({
  produkID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Produk',
    required: true
  },
  jumlah: {
    type: Number,
    required: true,
    min: 1
  },
  namaProduk: {
    type: String,
    required: true,
    trim: true
  },
  hargaJual: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    min: 0
  },
  sesiBookingID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SesiBooking',
    required: true
  }
}, { _id: false });

// Hitung subtotal otomatis sebelum validasi tiap item
ItemPenjualanSchema.pre('validate', function(next) {
  this.subtotal = this.jumlah * this.hargaJual;
  next();
});

// Schema utama Penjualan
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
    default: 0,
    min: 0
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

// Hitung totalHarga otomatis setelah subtotal tiap item dihitung
PenjualanSchema.pre('validate', function(next) {
  if (this.itemPenjualan && this.itemPenjualan.length > 0) {
    this.totalHarga = this.itemPenjualan.reduce((acc, item) => {
      const sub = Number(item.subtotal) || (item.jumlah * item.hargaJual);
      return acc + sub;
    }, 0);
  } else {
    this.totalHarga = 0;
  }
  next();
});

module.exports = mongoose.model('Penjualan', PenjualanSchema);
