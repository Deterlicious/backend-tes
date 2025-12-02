const mongoose = require("mongoose");

const JurnalTransferSchema = new mongoose.Schema(
  {
    // jurnalTransferID dihilangkan, menggunakan _id default MongoDB

    tanggal: {
      type: Date,
      required: [true, "Tanggal transfer wajib diisi."],
      index: true, // Optimasi sorting/laporan
    },

    // FK: Kas Sumber (Akun dari mana uang keluar)
    kasSumberID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "Kas Sumber wajib diisi."],
      index: true, // Optimasi pencarian
    },

    // FK: Kas Tujuan (Akun ke mana uang masuk)
    kasTujuanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "Kas Tujuan wajib diisi."],
      index: true, // Optimasi pencarian
    },

    jumlah: {
      type: Number,
      required: [true, "Jumlah transfer wajib diisi."],
      min: [1, "Jumlah transfer harus minimal 1."],
    },

    keterangan: {
      type: String,
      required: [true, "Keterangan wajib diisi."],
      trim: true,
    },

    // FK: Dicatat oleh User atau Staff
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna", // Menggunakan 'User' agar konsisten dengan praktik umum
      required: [true, "Pencatat wajib diisi."],
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
// Memastikan Kas Sumber dan Kas Tujuan tidak sama
JurnalTransferSchema.pre("validate", function (next) {
  if (
    this.kasSumberID &&
    this.kasTujuanID &&
    this.kasSumberID.equals(this.kasTujuanID)
  ) {
    // Mencegah transfer ke akun yang sama
    this.invalidate(
      "kasTujuanID",
      "Kas Sumber dan Kas Tujuan tidak boleh sama.",
      this.kasTujuanID
    );
    // Atau Anda bisa menggunakan: this.invalidate('kasSumberID', 'Kas Sumber dan Kas Tujuan tidak boleh sama.', this.kasSumberID);
  }
  next();
});

const JurnalTransfer = mongoose.model("JurnalTransfer", JurnalTransferSchema);

module.exports = JurnalTransfer;
