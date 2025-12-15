const mongoose = require("mongoose");

const tarifSchema = new mongoose.Schema(
  {
    namaTarif: {
      type: String,
      required: true,
      trim: true,
    },
    basisPerhitungan: {
      type: String,
      enum: ["per jam", "per sesi"],
      required: true,
    },
    harga: {
      type: Number,
      required: true,
      min: 0,
    },
    durasiMinimum: {
      type: Number,
      required: true,
      min: 1,
    },

    // --- RULES ENGINE FIELDS (BARU) ---

    // 1. Fallback: Dipakai jika tidak ada rule waktu yang cocok
    isDefault: {
      type: Boolean,
      default: false,
    },

    // 2. Filter Hari: 0=Minggu, 1=Senin, ..., 6=Sabtu
    // Kosong [] = Berlaku setiap hari
    hariAktif: {
      type: [Number],
      enum: [0, 1, 2, 3, 4, 5, 6],
      default: [],
    },

    // 3. Filter Jam: Format "HH:mm" (24 Jam)
    // Default "00:00" - "23:59" (Seharian)
    jamMulai: {
      type: String,
      default: "00:00",
      trim: true,
    },
    jamSelesai: {
      type: String,
      default: "23:59",
      trim: true,
    },

    // 4. Ranking: Angka lebih besar = Prioritas lebih tinggi (Menang saat bentrok)
    prioritas: {
      type: Number,
      default: 1,
    },

    // ----------------------------------

    tipeAsetID: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TipeAset",
      },
    ],
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes
tarifSchema.index({ tenantID: 1, namaTarif: 1 }, { unique: true });
tarifSchema.index({ tipeAsetID: 1 });
// Index baru untuk query pencarian tarif otomatis nanti
tarifSchema.index({ tenantID: 1, isDefault: 1 });
tarifSchema.index({ tenantID: 1, prioritas: -1 });

module.exports = mongoose.model("Tarif", tarifSchema);
