const mongoose = require("mongoose");

const BebanOperasionalSchema = new mongoose.Schema(
  {
    // bebanOperasionalID dihilangkan, menggunakan _id default MongoDB

    // FK: Akun Kas (dari mana dana dikeluarkan)
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "ID Akun Kas wajib diisi."],
      index: true, // Optimasi pencarian/populasi
    },

    // FK: Kategori Beban
    kategoriBebanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KategoriBeban",
      required: [true, "ID Kategori Beban wajib diisi."],
      index: true, // Optimasi pencarian/populasi
    },

    tanggal: {
      type: Date,
      required: [true, "Tanggal wajib diisi."],
      index: true, // Optimasi sorting/laporan
    },

    jumlah: {
      type: Number,
      required: [true, "Jumlah biaya wajib diisi."],
      min: [0, "Jumlah biaya tidak boleh negatif."],
    },

    keterangan: {
      type: String,
      required: [true, "Keterangan wajib diisi."],
      trim: true,
    },

    // FK: Dicatat oleh User atau Staff
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Mengganti 'Pengguna' menjadi 'User' agar konsisten
      required: [true, "Pencatat wajib diisi."],
      index: true,
    },

    // FK: Referensi ke Tenant (Wajib untuk data scoping)
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Optimasi filter multi-tenant
    },
  },
  {
    timestamps: true,
    versionKey: false, // Konsisten dengan model lain
  }
);

// --- PENGOPTIMALAN PENCARIAN ---

// Index kombinasi untuk optimasi pencarian beban per tenant dan tanggal
BebanOperasionalSchema.index({ tenantID: 1, tanggal: -1 });

// ----------------------------------

const BebanOperasional = mongoose.model(
  "BebanOperasional",
  BebanOperasionalSchema
);

module.exports = BebanOperasional;
