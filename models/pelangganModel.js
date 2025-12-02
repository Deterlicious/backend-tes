const mongoose = require("mongoose");

const PelangganSchema = new mongoose.Schema(
  {
    // pelangganID dihilangkan, menggunakan _id default MongoDB

    namaPelanggan: {
      type: String,
      required: [true, "Nama pelanggan wajib diisi."],
      trim: true,
    },

    tipePelanggan: {
      type: String,
      enum: {
        values: ["umum", "korporat", "member"],
        message:
          "{VALUE} bukan tipe pelanggan yang valid. Pilih salah satu: umum, korporat, atau member.",
      },
      required: [true, "Tipe pelanggan wajib diisi."],
      index: true, // Optimasi filter berdasarkan tipe pelanggan
    },

    nomorHp: {
      type: String,
      default: null, // nullable
      trim: true,
      // Index untuk pencarian cepat (misalnya untuk otentikasi/pencarian pelanggan)
      index: true,
    },

    email: {
      type: String,
      default: null, // nullable
      trim: true,
      // Tambahkan index jika email sering digunakan untuk pencarian
      index: true,
      // Anda bisa menambahkan validator match di sini jika diperlukan
    },

    alamat: {
      type: String,
      default: null, // nullable
      trim: true,
    },

    saldoPiutang: {
      type: Number,
      default: 0,
      min: [0, "Saldo Piutang tidak boleh negatif."],
    },

    poinLoyalitas: {
      type: Number,
      default: 0,
      min: [0, "Poin Loyalitas tidak boleh negatif."],
    },

    // FK: Referensi ke Tenant (Wajib untuk data scoping)
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Optimasi filter multi-tenant (wajib)
    },
  },
  {
    timestamps: true,
    versionKey: false, // Konsisten dengan model lain
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi namaPelanggan, nomorHp, dan/atau email dalam satu tenant.
//  Nama pelanggan harus unik per tenant.
PelangganSchema.index({ tenantID: 1, namaPelanggan: 1 }, { unique: true });

// (Sangat Disarankan): Nomor HP harus unik per tenant (gunakan `sparse: true` jika `nomorHp` nullable)
PelangganSchema.index(
  { tenantID: 1, nomorHp: 1 },
  { unique: true, sparse: true }
);

//  Email harus unik per tenant
PelangganSchema.index(
  { tenantID: 1, email: 1 },
  { unique: true, sparse: true }
);

// --------------------------------------------------

const Pelanggan = mongoose.model("Pelanggan", PelangganSchema);

module.exports = Pelanggan;
