const mongoose = require("mongoose");

const JurnalStokSchema = new mongoose.Schema(
  {
    // jurnalStokID dihilangkan, menggunakan _id default MongoDB

    // FK: Referensi ke BahanBaku
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      required: [true, "ID Bahan Baku wajib diisi."],
      index: true, // Optimasi pencarian/populasi
    },

    tanggal: {
      type: Date,
      required: [true, "Tanggal wajib diisi."],
      index: true, // Optimasi sorting/laporan
    },

    tipeKoreksi: {
      type: String,
      enum: {
        values: ["Masuk", "Keluar"],
        message: "Tipe Koreksi harus Masuk atau Keluar.",
      },
      required: [true, "Tipe Koreksi wajib diisi."],
    },

    jumlah: {
      type: Number,
      required: [true, "Jumlah wajib diisi."],
      min: [1, "Jumlah harus minimal 1."], // Jumlah harus positif
    },

    alasan: {
      type: String,
      enum: {
        values: ["Stok Opname", "Rusak/Hilang", "Transfer Gudang", "Lainnya"],
        message: "{VALUE} bukan alasan yang valid.",
      },
      required: [true, "Alasan koreksi wajib diisi."],
    },

    keterangan: {
      type: String,
      default: null, // nullable
      trim: true,
    },

    // FK: Dicatat oleh User atau Staff
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Mengganti 'Pengguna' menjadi 'User' agar konsisten
      required: [true, "Pencatat wajib diisi."],
      index: true,
    },

    locationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location", // Tabel baru (Master Lokasi)
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
    versionKey: false,
  }
);

// --- VALIDASI LOGIKA BISNIS (Cross-Field Validation) ---
// Memastikan keterangan diisi jika alasan adalah 'Lainnya'
JurnalStokSchema.pre("validate", function (next) {
  if (this.alasan === "Lainnya" && !this.keterangan) {
    this.invalidate(
      "keterangan",
      'Keterangan wajib diisi jika Alasan dipilih "Lainnya".',
      this.keterangan
    );
  }
  next();
});

// --- PENGOPTIMALAN PENCARIAN ---
// Index kombinasi untuk optimasi pencarian jurnal stok per tenant dan bahan baku
JurnalStokSchema.index({ tenantID: 1, bahanBakuID: 1, tanggal: -1 });

const JurnalStok = mongoose.model("JurnalStok", JurnalStokSchema);

module.exports = JurnalStok;
