const mongoose = require('mongoose');

// Subschema untuk ItemPembelianStok (Asumsi sederhana)
const ItemPembelianStokSchema = new mongoose.Schema({
    bahanBakuID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BahanBaku', // Asumsi nama model Bahan Baku
        required: true
    },
    jumlah: {
        type: Number,
        required: true,
        min: 1
    },
    hargaBeli: {
        type: Number,
        required: true,
        min: 0
    },
    subtotal: {
        type: Number,
        min: 0
    }
}, { _id: false });

// Hitung subtotal otomatis
ItemPembelianStokSchema.pre('validate', function(next) {
    this.subtotal = this.jumlah * this.hargaBeli;
    next();
});

// Schema utama PembelianStok
const PembelianStokSchema = new mongoose.Schema({
    // pembelianStokID dihilangkan, menggunakan _id default MongoDB

    tanggal: {
        type: Date,
        required: true,
    },
    
    // FK: Akun Kas (dari mana dana dikeluarkan)
    akunKasID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AkunKas', 
        required: true,
    },
    
    totalBiaya: {
        type: Number,
        required: true,
        min: 0,
    },
    
    supplier: {
        type: String,
        required: true,
        trim: true,
    },
    
    keterangan: {
        type: String,
        required: true,
        trim: true,
    },
    
    items: {
        type: [ItemPembelianStokSchema], // Embedded subdocuments
        required: true,
    },

    // FK: Referensi ke Tenant (Wajib untuk data scoping)
    tenantID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant', 
        required: true,
    },
    
    nomorFaktur: {
        type: String,
        default: null, // nullable
        trim: true,
    },
    
    // FK: Dicatat oleh User atau Staff
    dicatatOleh: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pengguna', 
        required: true,
    },
}, {
    timestamps: true,
    versionKey: false,
});

// Hitung totalBiaya otomatis
PembelianStokSchema.pre('validate', function(next) {
    if (this.items && this.items.length > 0) {
        this.totalBiaya = this.items.reduce((acc, item) => {
            const sub = Number(item.subtotal) || (item.jumlah * item.hargaBeli);
            return acc + sub;
        }, 0);
    } else {
        this.totalBiaya = 0;
    }
    next();
});

const PembelianStok = mongoose.model('PembelianStok', PembelianStokSchema);

module.exports = PembelianStok;