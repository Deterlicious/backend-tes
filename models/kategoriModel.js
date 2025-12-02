const mongoose = require("mongoose");

const kategoriSchema = new mongoose.Schema(
  {
    namaKategori: {
      type: String,
      required: [true, "Nama kategori wajib diisi."], // Validasi kustom
      trim: true,
      index: true, // Index untuk optimasi pencarian berdasarkan nama
    },
    kodeKategori: {
      type: String,
      required: [true, "Kode kategori wajib diisi."], // Validasi kustom
      trim: true, // Unique Index akan kita buat di level skema agar scoped per tenant
    },
    keterangan: {
      type: String,
      default: null,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant", // asumsi kamu punya model Tenant
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Index untuk optimasi pencarian dan filtering (multi-tenant)
    },
  },
  {
    timestamps: true,
    versionKey: false, // Menghilangkan field __v
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi namaKategori dalam satu tenant.
// Kategori yang sama boleh ada di tenant yang berbeda.
kategoriSchema.index({ tenantID: 1, namaKategori: 1 }, { unique: true });

// 2. Index Unik (Integritas Data): Mencegah duplikasi kodeKategori dalam satu tenant.
kategoriSchema.index({ tenantID: 1, kodeKategori: 1 }, { unique: true });

// --------------------------------------------------

module.exports = mongoose.model("Kategori", kategoriSchema);
