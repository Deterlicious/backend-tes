const mongoose = require("mongoose");

const DiskonSchema = new mongoose.Schema(
  {
    // diskonID dihilangkan, menggunakan _id default MongoDB

    namaDiskon: {
      type: String,
      required: [true, "Nama diskon wajib diisi."],
      trim: true,
      // Hapus 'unique: true' di sini, akan diganti dengan compound index di bawah
      index: true, // Optimasi pencarian berdasarkan nama
    },

    tipe: {
      type: String,
      enum: {
        values: ["persen", "nominal"],
        message:
          "{VALUE} bukan tipe diskon yang valid. Pilih salah satu: persen atau nominal.",
      },
      required: [true, "Tipe diskon wajib diisi."],
      index: true, // Optimasi filter berdasarkan tipe
    },

    nilai: {
      type: Number,
      required: [true, "Nilai diskon wajib diisi."],
      min: [0, "Nilai diskon tidak boleh negatif."],
      // Validator Kustom: Jika tipe persen, nilai tidak boleh > 100 (sudah ada)
      validate: {
        validator: function (v) {
          if (this.tipe === "persen" && v > 100) {
            return false;
          }
          return true;
        },
        message: "Diskon bertipe persen tidak boleh melebihi 100.",
      },
      index: true, // Optimasi sorting/filter berdasarkan nilai
    },

    status: {
      type: String,
      enum: {
        values: ["Aktif", "Non-Aktif"],
        message:
          "{VALUE} bukan status yang valid. Pilih salah satu: Aktif atau Non-Aktif.",
      },
      default: "Aktif",
      required: [true, "Status wajib diisi."],
      index: true, // Optimasi filter status
    },

    perluOtorisasi: {
      type: Boolean,
      default: false,
      required: [true, "Perlu otorisasi wajib diisi."],
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
    versionKey: false, // Konsisten dengan model lain
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi namaDiskon dalam satu tenant.
DiskonSchema.index({ tenantID: 1, namaDiskon: 1 }, { unique: true });

// --------------------------------------------------

const Diskon = mongoose.model("Diskon", DiskonSchema);

module.exports = Diskon;
