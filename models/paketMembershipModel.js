const mongoose = require("mongoose");

const PaketMembershipSchema = new mongoose.Schema(
  {
    // paketMembershipID dihilangkan, menggunakan _id default MongoDB

    namaPaket: {
      type: String,
      required: [true, "Nama paket wajib diisi."],
      trim: true,
      // Hapus 'unique: true' di sini, akan diganti dengan compound index di bawah
      index: true, // Index untuk optimasi pencarian berdasarkan nama
    },

    harga: {
      type: Number,
      required: [true, "Harga paket wajib diisi."],
      min: [0, "Harga tidak boleh negatif."],
      index: true, // Index untuk optimasi sorting/filter harga
    },

    durasiHari: {
      type: Number,
      required: [true, "Durasi hari wajib diisi."],
      min: [1, "Durasi hari harus minimal 1 hari."],
    },

    deskripsi: {
      type: String,
      default: null, // nullable
      trim: true,
    },

    status: {
      type: String,
      enum: {
        values: ["Aktif", "Non-Aktif"],
        message:
          "{VALUE} bukan status yang valid. Pilih salah satu: Aktif atau Non-Aktif.",
      },
      default: "Aktif",
      required: [true, "Status paket wajib diisi."],
      index: true, // Index untuk optimasi filter status
    },

    // FK: Referensi ke Tenant
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Index untuk optimasi filter multi-tenant (wajib)
    },
  },
  {
    timestamps: true,
    versionKey: false, // Konsisten dengan model lain
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi namaPaket dalam satu tenant.
PaketMembershipSchema.index({ tenantID: 1, namaPaket: 1 }, { unique: true });

// --------------------------------------------------

const PaketMembership = mongoose.model(
  "PaketMembership",
  PaketMembershipSchema
);

module.exports = PaketMembership;
