const mongoose = require("mongoose");

const KategoriBebanSchema = new mongoose.Schema(
  {
    // kategoriBebanID dihilangkan, menggunakan _id default MongoDB

    namaKategori: {
      type: String,
      // Tambahkan pesan error kustom
      required: [true, "Nama kategori wajib diisi."],
      trim: true,
      // Hapus 'unique: true' di sini, akan diganti dengan compound index di bawah
      index: true, // Index untuk optimasi pencarian berdasarkan nama
    },

    // FK: Referensi ke Tenant (Wajib untuk data scoping)
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      // Tambahkan pesan error kustom
      required: [true, "Tenant ID wajib diisi."],
      // Index untuk optimasi filter
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false, // Konsisten dengan model lain
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi namaKategori dalam satu tenant.
KategoriBebanSchema.index({ tenantID: 1, namaKategori: 1 }, { unique: true });

// --------------------------------------------------

const KategoriBeban = mongoose.model("KategoriBeban", KategoriBebanSchema);

module.exports = KategoriBeban;
