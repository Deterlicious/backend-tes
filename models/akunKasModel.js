const mongoose = require("mongoose");

const AkunKasSchema = new mongoose.Schema(
  {
    namaAkun: {
      type: String,
      // Tambahkan pesan error kustom
      required: [true, "Nama akun wajib diisi."],
      trim: true,
    },
    saldo: {
      type: Number,
      required: [true, "Saldo awal wajib diisi."],
      default: 0,
      // Tambahkan pesan error kustom
      min: [0, "Saldo tidak boleh negatif."],
    },
    tipeAkun: {
      type: String,
      enum: {
        values: ["Kas Fisik", "Rekening Bank"],
        message:
          "{VALUE} bukan tipe akun yang valid. Pilih salah satu: Kas Fisik atau Rekening Bank.",
      },
      required: [true, "Tipe akun wajib diisi."],
    },
    status: {
      type: String,
      enum: {
        values: ["aktif", "non-aktif"],
        message:
          "{VALUE} bukan status yang valid. Pilih salah satu: aktif atau non-aktif.",
      },
      default: "aktif",
    },
    nomorAkun: {
      type: String,
      required: [true, "Nomor akun wajib diisi."],
      trim: true,
      // Hapus 'unique: true' di sini, akan diganti dengan compound index di bawah
    },
    keterangan: {
      type: String,
      default: null,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      // Index untuk optimasi filter
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// --- PENGOPTIMALAN PENCARIAN & INTEGRITAS DATA ---

// 1. Index Unik (Integritas Data): Mencegah duplikasi nomorAkun dalam satu tenant.
// Akun Kas yang sama boleh ada di tenant yang berbeda.
AkunKasSchema.index({ tenantID: 1, nomorAkun: 1 }, { unique: true });

// 2. Index Single Field (Optimasi Pencarian): Untuk pencarian cepat berdasarkan nama akun.
AkunKasSchema.index({ namaAkun: 1 });

// --------------------------------------------------

const AkunKas = mongoose.model("AkunKas", AkunKasSchema);

module.exports = AkunKas;
