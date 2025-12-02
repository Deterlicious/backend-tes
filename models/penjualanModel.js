const mongoose = require("mongoose");

// Subschema untuk ItemPenjualan
const ItemPenjualanSchema = new mongoose.Schema(
  {
    produkID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produk",
      required: [true, "ID Produk wajib diisi."],
      index: true, // Optimasi pencarian/populasi item per produk
    },
    jumlah: {
      type: Number,
      required: [true, "Jumlah wajib diisi."],
      min: [1, "Jumlah harus minimal 1."],
    },
    namaProduk: {
      type: String,
      required: [true, "Nama Produk wajib diisi."],
      trim: true,
    },
    hargaJual: {
      type: Number,
      required: [true, "Harga Jual wajib diisi."],
      min: [0, "Harga Jual tidak boleh negatif."],
    },
    hargaKotor: {
      type: Number,
      min: [0, "Harga Kotor tidak boleh negatif."],
      default: 0,
    },
    diskonID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Diskon",
      default: null, // nullable
      index: true, // Optimasi populasi/filter diskon
    },
    jumlahDiskon: {
      type: Number,
      required: [true, "Jumlah Diskon wajib diisi."],
      default: 0,
      min: [0, "Jumlah Diskon tidak boleh negatif."],
    },
    subtotal: {
      type: Number,
      min: [0, "Subtotal tidak boleh negatif."],
      default: 0,
    },
    sesiBookingID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SesiBooking",
      default: null, // nullable
      index: true, // Optimasi filter/populasi booking
    },
  },
  { _id: false }
);

// Hook pre-validate untuk ItemPenjualan (menghitung harga kotor dan subtotal)
ItemPenjualanSchema.pre("validate", function (next) {
  this.hargaKotor = this.hargaJual * this.jumlah;
  this.subtotal = this.hargaKotor - this.jumlahDiskon;
  // Validasi min: 0 sudah ditangani oleh path validator
  next();
});

// Schema utama Penjualan
const PenjualanSchema = new mongoose.Schema(
  {
    tanggalPenjualan: {
      type: Date,
      required: [true, "Tanggal Penjualan wajib diisi."],
      index: true, // Optimasi sorting dan laporan
    },
    nomorFaktur: {
      type: String,
      // Hapus unique: true di sini, akan dipindahkan ke compound index
      required: [true, "Nomor Faktur wajib diisi."],
      trim: true,
    },
    jenisPenjualan: {
      type: String,
      enum: {
        values: ["dine-in", "takeaway", "booking"],
        message:
          "{VALUE} bukan jenis penjualan yang valid. Pilihan: dine-in, takeaway, booking.",
      },
      required: [true, "Jenis Penjualan wajib diisi."],
    },
    totalHarga: {
      type: Number,
      required: [true, "Total Harga wajib diisi."],
      default: 0,
      min: [0, "Total Harga tidak boleh negatif."],
    },
    namaPelanggan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pelanggan",
      default: null,
      index: true, // Optimasi filter/populasi pelanggan
    },
    itemPenjualan: {
      type: [ItemPenjualanSchema],
      required: [true, "Item Penjualan wajib diisi."],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Optimasi filter multi-tenant (wajib)
    },
    statusPembayaran: {
      type: String,
      enum: {
        values: ["UNPAID", "PARTIAL", "PAID"],
        message:
          "Status pembayaran tidak valid. Pilihan: UNPAID, PARTIAL, PAID.",
      },
      default: "UNPAID",
      index: true, // Optimasi filter status
    },
    sisaTagihan: {
      type: Number,
      default: 0,
      min: [0, "Sisa Tagihan tidak boleh negatif."],
    },
  },
  {
    timestamps: true,
    versionKey: false, // Konsisten dengan model lain
  }
);

// Hook pre-validate untuk Penjualan (menghitung Total Harga dan Sisa Tagihan)
PenjualanSchema.pre("validate", function (next) {
  if (this.itemPenjualan && this.itemPenjualan.length > 0) {
    this.totalHarga = this.itemPenjualan.reduce((acc, item) => {
      const sub = Number(item.subtotal) || 0;
      return acc + sub;
    }, 0);
  } else {
    this.totalHarga = 0;
  }

  // Perbarui sisa Tagihan (Asumsi sisaTagihan = totalHarga pada saat pembuatan)
  if (this.isNew || this.isModified("totalHarga")) {
    // Note: Anda mungkin perlu logika yang lebih kompleks di controller
    // untuk menghitung sisaTagihan berdasarkan pembayaran yang sudah masuk.
    // Jika isNew, kita set sisaTagihan sama dengan totalHarga.
    if (this.isNew) {
      this.sisaTagihan = this.totalHarga;
    }
  }

  next();
});

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi nomorFaktur dalam satu tenant.
PenjualanSchema.index({ tenantID: 1, nomorFaktur: 1 }, { unique: true });

// --------------------------------------------------

module.exports = mongoose.model("Penjualan", PenjualanSchema);
