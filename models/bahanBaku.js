const mongoose = require('mongoose');

const bahanBakuSchema = new mongoose.Schema({
  BahanBakuID: {
    type: String,
    required: true,
    unique: true
  },
  namaBahan: {
    type: String,
    required: true
  },
  stok: {
    type: Number,
    required: true,
    default: 0
  },
  satuan: {
    type: String,
    required: true
  }
});

const BahanBaku = mongoose.model('BahanBaku', bahanBakuSchema);
module.exports = BahanBaku;
