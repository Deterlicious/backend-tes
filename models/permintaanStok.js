const mongoose = require("mongoose");

const PermintaanStokSchema = new mongoose.Schema(
  {
    nomorRequest: {
      type: String,
      required: true,
      unique: true, // e.g., "REQ/OUT-A/001"
    },

    // asal permintaan (Biasanya Outlet)
    dariLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    // tujuan permintaan (Biasanya Gudang)
    keLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    // DRAFT: Outlet masih pilih2 barang
    // SUBMITTED: Sudah dikirim ke Gudang (Gudang dapat notif)
    // APPROVED: Gudang setuju & sedang proses packing (Otomatis buat TransferStok)
    // REJECTED: Gudang tolak (Stok kosong dll)
    // COMPLETED: Barang sudah diterima Outlet
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "COMPLETED"],
      default: "DRAFT",
    },

    // item permintaan stok
    items: [
      {
        bahanBakuID: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BahanBaku",
          required: true,
        },
        // Jumlah yang diminta Outlet
        qtyRequest: {
          type: Number,
          required: true,
          min: 1,
        },
        // Jumlah yang disetujui Gudang (Bisa lebih sedikit dari request jika stok tipis)
        qtyApproved: {
          type: Number,
          default: 0,
        },
        catatan: {
          type: String,
          default: null,
        },
      },
    ],

    // Relasi ke TransferStok. jika sudah di-approve, simpan ID TransferStok yang terbentuk di sini agar bisa dilacak
    transferStokID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransferStok",
      default: null,
    },

    tanggalRequest: {
      type: Date,
      default: Date.now,
    },

    dimintaOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },

    diprosesOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna", // Admin Gudang yang approve/reject
      default: null,
    },

    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PermintaanStok", PermintaanStokSchema);
