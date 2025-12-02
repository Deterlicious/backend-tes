const mongoose = require("mongoose");

// Subschema untuk ItemPembelianStok (Embedded Subdocuments)
const ItemPembelianStokSchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku", // Asumsi nama model Bahan Baku
      required: [true, "ID Bahan Baku wajib diisi."],
    },
    jumlah: {
      type: Number,
      required: [true, "Jumlah wajib diisi."],
      min: [1, "Jumlah pembelian harus minimal 1."],
    },
    hargaBeli: {
      type: Number,
      required: [true, "Harga beli wajib diisi."],
      min: [0, "Harga beli tidak boleh negatif."],
    },
    subtotal: {
      type: Number,
      min: [0, "Subtotal tidak boleh negatif."],
      default: 0, // Tambahkan default agar konsisten
    },
  },
  { _id: false }
);

// Hook pre-validate untuk ItemPembelianStok (menghitung subtotal)
ItemPembelianStokSchema.pre("validate", function (next) {
  this.subtotal = this.jumlah * this.hargaBeli;
  next();
});

// Schema utama PembelianStok
const PembelianStokSchema = new mongoose.Schema(
  {
    tanggal: {
      type: Date,
      required: [true, "Tanggal wajib diisi."],
    },
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "ID Akun Kas wajib diisi."],
      index: true, // Optimasi filter
    },
    totalBiaya: {
      type: Number,
      required: [true, "Total biaya wajib diisi."],
      default: 0,
      min: [0, "Total biaya tidak boleh negatif."],
    },
    supplier: {
      type: String,
      required: [true, "Nama supplier wajib diisi."],
      trim: true,
    },
    keterangan: {
      type: String,
      required: [true, "Keterangan wajib diisi."],
      trim: true,
    },
    items: {
      type: [ItemPembelianStokSchema], // Embedded subdocuments
      required: [true, "Daftar item pembelian wajib diisi."],
    },

    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Optimasi filter
    },
    nomorFaktur: {
      type: String,
      default: null, // nullable
      trim: true, // Tambahkan unique index jika nomor faktur harus unik per tenant
    },
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: [true, "ID Pencatat wajib diisi."],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Hook pre-validate untuk PembelianStok (menghitung totalBiaya)
PembelianStokSchema.pre("validate", function (next) {
  if (this.items && this.items.length > 0) {
    this.totalBiaya = this.items.reduce((acc, item) => {
      // Gunakan subtotal yang sudah dihitung oleh sub-schema hook
      const sub = Number(item.subtotal) || item.jumlah * item.hargaBeli;
      return acc + sub;
    }, 0);
  } else {
    this.totalBiaya = 0;
  }
  next();
});

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Optional): Mencegah duplikasi Nomor Faktur dalam satu tenant.
// Jika nomor faktur harus unik per tenant, aktifkan ini:
PembelianStokSchema.index(
  { tenantID: 1, nomorFaktur: 1 },
  { unique: true, sparse: true }
); // sparse: true untuk mengizinkan banyak null

// 2. Index Single Field: Optimasi pencarian
PembelianStokSchema.index({ tanggal: -1 });

// --------------------------------------------------

const PembelianStok = mongoose.model("PembelianStok", PembelianStokSchema);

module.exports = PembelianStok;
