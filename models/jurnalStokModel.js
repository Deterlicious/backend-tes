const mongoose = require('mongoose');

const JurnalStokSchema = new mongoose.Schema({
  // jurnalStokID dihilangkan, menggunakan _id default MongoDB

  // FK: Referensi ke BahanBaku
  bahanBakuID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BahanBaku', // Asumsi nama model adalah 'BahanBaku'
    required: true,
  },
  
  tanggal: {
    type: Date,
    required: true,
  },
  
  tipeKoreksi: {
    type: String,
    enum: ['Masuk', 'Keluar'],
    required: true,
  },
  
  jumlah: {
    type: Number,
    required: true,
    min: 1, // Jumlah harus positif
  },
  
  alasan: {
    type: String,
    enum: ['Stok Opname', 'Rusak/Hilang', 'Transfer Gudang', 'Lainnya'],
    required: true,
  },
  
  keterangan: {
    type: String,
    default: null, // nullable
    // Penjelasan lebih detail jika alasan = "Lainnya" (Validasi bisa di controller)
  },

  // FK: Dicatat oleh User atau Staff (Asumsi model 'User' atau 'Staff')
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

const JurnalStok = mongoose.model('JurnalStok', JurnalStokSchema);

module.exports = JurnalStok;