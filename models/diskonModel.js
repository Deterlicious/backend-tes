const mongoose = require('mongoose');

const DiskonSchema = new mongoose.Schema({
  // diskonID dihilangkan, menggunakan _id default MongoDB

  namaDiskon: {
    type: String,
    required: [true, 'Nama diskon wajib diisi.'],
    trim: true,
    unique: true // Nama diskon unik
  },
  
  tipe: {
    type: String,
    enum: {
        values: ['persen', 'nominal'],
        message: '{VALUE} bukan tipe diskon yang valid. Pilih salah satu: persen atau nominal.'
    },
    required: [true, 'Tipe diskon wajib diisi.'],
  },
  
  nilai: {
    type: Number,
    required: [true, 'Nilai diskon wajib diisi.'],
    min: [0, 'Nilai diskon tidak boleh negatif.'],
    // Validator Kustom: Jika tipe persen, nilai tidak boleh > 100
    validate: {
        validator: function(v) {
            if (this.tipe === 'persen' && v > 100) {
                return false;
            }
            return true;
        },
        message: 'Diskon bertipe persen tidak boleh melebihi 100.'
    }
  },
  
  status: {
    type: String,
    enum: {
        values: ['Aktif', 'Non-Aktif'],
        message: '{VALUE} bukan status yang valid. Pilih salah satu: Aktif atau Non-Aktif.'
    },
    default: 'Aktif',
    required: [true, 'Status wajib diisi.'],
  },
  
  perluOtorisasi: {
    type: Boolean,
    default: false,
    required: [true, 'Perlu otorisasi wajib diisi.'],
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

const Diskon = mongoose.model('Diskon', DiskonSchema);

module.exports = Diskon;