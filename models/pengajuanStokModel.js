const mongoose = require("mongoose");

const PengajuanStokSchema = new mongoose.Schema(
  {
    nomorPengajuan: { type: String, required: true, unique: true },
    jenisPengajuan: {
      type: String,
      enum: ["PERMINTAAN", "PENGIRIMAN"],
      default: "PERMINTAAN",
    },
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
        jumlah: { type: Number, required: true }, // Nilai tersimpan dalam satuan base (kg, liter, dll)
        satuan: { type: String, required: true },  // Satuan base BahanBaku
      },
    ],

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "PENDING", "REJECTED", "COMPLETED"],
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
PengajuanStokSchema.index({ tenantID: 1, status: 1 });
PengajuanStokSchema.index({ transferStokID: 1 }); // Penting untuk pencarian relasi
PengajuanStokSchema.index({ dariLocationID: 1 });
PengajuanStokSchema.index({ keLocationID: 1 });

module.exports = mongoose.model("PengajuanStok", PengajuanStokSchema);
