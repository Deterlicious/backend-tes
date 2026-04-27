const mongoose = require("mongoose");

const PermintaanStokSchema = new mongoose.Schema(
  {
    nomorRequest: { type: String, required: true, unique: true },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    dariLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    keLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    dimintaOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
    disetujuiOleh: { type: mongoose.Schema.Types.ObjectId, ref: "Pengguna" },
    ditolakOleh: { type: mongoose.Schema.Types.ObjectId, ref: "Pengguna" },

    // Menghubungkan ke tabel Surat Jalan (TransferStok)
    transferStokID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferStok",
      default: null,
    },

    items: [
      {
        bahanBakuID: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BahanBaku",
          required: true,
        },
        jumlah: { type: Number, required: true },
        satuan: { type: String, required: true },
      },
    ],

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "COMPLETED"],
      default: "DRAFT",
    },

    catatan: { type: String },
    catatanPenolakan: { type: String },
    tanggalKebutuhan: { type: Date },
    tanggalApprove: { type: Date },
    tanggalReject: { type: Date },
  },
  { timestamps: true },
);

// Indexing untuk Optimasi
PermintaanStokSchema.index({ tenantID: 1, status: 1 });
PermintaanStokSchema.index({ transferStokID: 1 }); // Penting untuk pencarian relasi
PermintaanStokSchema.index({ dariLocationID: 1 });
PermintaanStokSchema.index({ keLocationID: 1 });

module.exports = mongoose.model("PermintaanStok", PermintaanStokSchema);
