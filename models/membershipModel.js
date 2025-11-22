const mongoose = require('mongoose');

const MembershipSchema = new mongoose.Schema({
  // membershipID dihilangkan, menggunakan _id default MongoDB

  // FK: Referensi ke Pelanggan
  PelangganID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pelanggan', 
    required: [true, 'ID Pelanggan wajib diisi.'],
  },
  
  // FK: Referensi ke Paket Membership
  paketMembershipID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaketMembership', // Asumsi nama model paket membership
    required: [true, 'ID Paket Membership wajib diisi.'],
  },
  
  tanggalMulai: {
    type: Date,
    required: [true, 'Tanggal Mulai wajib diisi.'],
  },
  
  tanggalKadaluarsa: {
    type: Date,
    required: [true, 'Tanggal Kadaluarsa wajib diisi.'],
    // Validasi: Pastikan tanggal Kadaluarsa lebih dari tanggal Mulai.
    validate: {
        validator: function(v) {
            return v >= this.tanggalMulai;
        },
        message: 'Tanggal Kadaluarsa harus sama atau setelah Tanggal Mulai.'
    }
  },
  
  status: {
    type: String,
    enum: {
        values: ['Aktif', 'Kadaluarsa'],
        message: 'Status harus Aktif atau Kadaluarsa.'
    },
    default: 'Aktif',
    required: [true, 'Status wajib diisi.'],
  },

  // FK: Referensi ke Penjualan (transaksi saat membership dibeli)
  penjualanID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Penjualan', 
    required: [true, 'ID Penjualan wajib diisi.'],
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

const Membership = mongoose.model('Membership', MembershipSchema);

module.exports = Membership;