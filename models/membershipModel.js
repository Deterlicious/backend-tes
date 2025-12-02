const mongoose = require("mongoose");

const MembershipSchema = new mongoose.Schema(
  {
    // membershipID dihilangkan, menggunakan _id default MongoDB

    // FK: Referensi ke Pelanggan
    PelangganID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pelanggan",
      required: [true, "ID Pelanggan wajib diisi."],
      index: true, // Optimasi filter/populasi
    },

    // FK: Referensi ke Paket Membership
    paketMembershipID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaketMembership",
      required: [true, "ID Paket Membership wajib diisi."],
      index: true, // Optimasi filter/populasi
    },

    tanggalMulai: {
      type: Date,
      required: [true, "Tanggal Mulai wajib diisi."],
      index: true, // Optimasi sorting/laporan
    },

    tanggalKadaluarsa: {
      type: Date,
      required: [true, "Tanggal Kadaluarsa wajib diisi."],
      index: true, // Optimasi filter tanggal kadaluarsa
      // Validasi: Pastikan tanggal Kadaluarsa lebih dari tanggal Mulai (sudah ada)
    },

    status: {
      type: String,
      enum: {
        values: ["Aktif", "Kadaluarsa"],
        message: "Status harus Aktif atau Kadaluarsa.",
      },
      default: "Aktif",
      required: [true, "Status wajib diisi."],
      index: true, // Optimasi filter status
    },

    // FK: Referensi ke Penjualan (transaksi saat membership dibeli)
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: [true, "ID Penjualan wajib diisi."],
      unique: true, // Satu penjualan hanya bisa memicu satu membership (sangat disarankan)
      index: true, // Optimasi pencarian/populasi
    },

    // FK: Referensi ke Tenant
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Optimasi filter multi-tenant (wajib)
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Memastikan satu Pelanggan hanya memiliki satu membership yang Aktif per tenant pada waktu tertentu (opsional, tergantung bisnis logic).
// Jika PelangganID + tenantID harus unik (misalnya, hanya 1 membership per pelanggan):
// MembershipSchema.index({ tenantID: 1, PelangganID: 1 }, { unique: true });

// 2. Index Gabungan untuk Filter Cepat
MembershipSchema.index({ PelangganID: 1, status: 1 });

const Membership = mongoose.model("Membership", MembershipSchema);

module.exports = Membership;
