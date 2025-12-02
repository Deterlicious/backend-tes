const mongoose = require("mongoose");

const sesiBookingSchema = new mongoose.Schema(
  {
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: true,
      index: true, // Untuk mencari booking dari ID Transaksi
    },
    asetID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aset",
      required: true,
      index: true, // Penting untuk cek ketersediaan aset
    },
    waktuMulai: {
      type: Date,
      required: true,
    },
    waktuSelesai: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Aktif", "Selesai", "Batal"],
      default: "Aktif",
      index: true,
    },
    durasiMenit: {
      type: Number,
      default: null,
    },
    totalBiaya: {
      type: Number,
      default: null,
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// == Compound Indexes ==
// 1. Optimasi Cek Bentrok: Cari aset X yang statusnya Aktif pada waktu tertentu
sesiBookingSchema.index({ asetID: 1, status: 1, waktuMulai: 1 });

// 2. Optimasi Laporan: List booking per tenant urut tanggal terbaru
sesiBookingSchema.index({ tenantID: 1, waktuMulai: -1 });

// Middleware Pre-Save untuk hitung durasi otomatis
sesiBookingSchema.pre("save", function (next) {
  if (this.waktuMulai && this.waktuSelesai) {
    const diffMs = new Date(this.waktuSelesai) - new Date(this.waktuMulai);
    this.durasiMenit = Math.ceil(diffMs / (1000 * 60)); // Pembulatan ke atas
  }
  next();
});

module.exports = mongoose.model("SesiBooking", sesiBookingSchema);