const mongoose = require("mongoose");

// Subschema untuk ItemPenjualan
const ItemPenjualanSchema = new mongoose.Schema(
  {
    produkID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produk",
      required: [true, "ID Produk wajib diisi."],
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
      // hargaJual * jumlah
      type: Number,
      min: [0, "Harga Kotor tidak boleh negatif."],
      default: 0,
    },
    diskonID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Diskon",
      default: null, // nullable
    },
    jumlahDiskon: {
      type: Number,
      required: [true, "Jumlah Diskon wajib diisi."],
      default: 0,
      min: [0, "Jumlah Diskon tidak boleh negatif."],
    },
    subtotal: {
      // hargaKotor - jumlahDiskon
      type: Number,
      min: [0, "Subtotal tidak boleh negatif."],
      default: 0,
    },
    sesiBookingID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SesiBooking",
      default: null, // nullable
    },
  },
  { _id: false }
);

// Hook pre-validate untuk ItemPenjualan (menghitung harga kotor dan subtotal)
ItemPenjualanSchema.pre("validate", function (next) {
  // 1. Hitung Harga Kotor
  this.hargaKotor = this.hargaJual * this.jumlah;

  // 2. Hitung Subtotal (Harga Kotor - Jumlah Diskon)
  this.subtotal = this.hargaKotor - this.jumlahDiskon;

  // Validasi: Subtotal tidak boleh negatif
  if (this.subtotal < 0) {
    // Mongoose akan menangkap error dari custom path validator (min: 0) di atas
    // atau kita bisa memicu invalidate di sini:
    // this.invalidate('subtotal', 'Subtotal tidak boleh negatif.', this.subtotal);
  }

  next();
});

// Schema utama Penjualan
const PenjualanSchema = new mongoose.Schema(
  {
    tanggalPenjualan: {
      type: Date,
      required: [true, "Tanggal Penjualan wajib diisi."],
    },
    nomorFaktur: {
      type: String,
      unique: true,
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
      // Total dari semua itemPenjualan[subtotal]
      type: Number,
      required: [true, "Total Harga wajib diisi."],
      default: 0,
      min: [0, "Total Harga tidak boleh negatif."],
    },
    namaPelanggan: {
      type: mongoose.Schema.Types.ObjectId, // Asumsi ini adalah FK ke model Pelanggan
      ref: "Pelanggan",
      default: null,
    },
    itemPenjualan: {
      type: [ItemPenjualanSchema],
      required: [true, "Item Penjualan wajib diisi."],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
    },
    statusPembayaran: {
      type: String,
      enum: {
        values: ["UNPAID", "PARTIAL", "PAID"],
        message:
          "{VALUE} bukan status pembayaran yang valid. Pilihan: UNPAID, PARTIAL, PAID.",
      },
      default: "UNPAID",
    },
    sisaTagihan: {
      type: Number,
      default: 0,
      min: [0, "Sisa Tagihan tidak boleh negatif."],
    },
  },
  { timestamps: true }
);

// Hook pre-validate untuk Penjualan (menghitung Total Harga)
PenjualanSchema.pre("validate", function (next) {
  if (this.itemPenjualan && this.itemPenjualan.length > 0) {
    this.totalHarga = this.itemPenjualan.reduce((acc, item) => {
      // Gunakan nilai subtotal yang sudah dihitung oleh sub-schema hook
      const sub = Number(item.subtotal) || 0;
      return acc + sub;
    }, 0);
  } else {
    this.totalHarga = 0;
  }

  // Perbarui sisa Tagihan (Asumsi sisaTagihan = totalHarga pada saat pembuatan)
  if (this.isNew) {
    this.sisaTagihan = this.totalHarga;
  }

  next();
});

module.exports = mongoose.model("Penjualan", PenjualanSchema);
