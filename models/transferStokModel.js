const mongoose = require("mongoose");

const TransferStokSchema = new mongoose.Schema(
  {
    nomorTransfer: {
      type: String,
      required: true,
      unique: true, // e.g., "TRF/GDG/001"
    },

    permintaanStokID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PermintaanStok",
      required: true, // Tambahkan required agar jika kosong langsung error di awal
    },
    // RELASI: DARI MANA? (Biasanya Gudang)
    dariLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    // RELASI: KE MANA? (Biasanya Outlet)
    keLocationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    // STATUS PENGIRIMAN (Critical untuk Logika WMS)
    // PENDING: Draft dibuat
    // DIKIRIM: Barang keluar dari Gudang (Stok Gudang berkurang)
    // DITERIMA: Barang sampai di Toko (Stok Toko bertambah)
    // BATAL: Transaksi dibatalkan
    status: {
      type: String,
      enum: ["PENDING", "DIKIRIM", "DITERIMA", "BATAL"],
      default: "PENDING",
    },

    // APA YANG DIPINDAHKAN?
    items: [
      {
        bahanBakuID: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BahanBaku",
          required: true,
        },
        // Jumlah yang dikirim oleh Gudang
        qtyKirim: {
          type: Number,
          required: true,
          min: 1,
        },
        // Jumlah yang fisik diterima oleh Toko (bisa beda jika ada rusak di jalan)
        qtyTerima: {
          type: Number,
          default: 0,
        },
        // Misal: "Pecah 1 bungkus di jalan"
        catatanItem: {
          type: String,
          default: null,
        },
      },
    ],

    // RIWAYAT WAKTU
    tanggalKirim: {
      type: Date,
      required: true,
    },

    tanggalTerima: {
      type: Date,
      default: null,
    },

    // RELASI: SIAPA YANG TANGGUNG JAWAB?
    pengirimID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },

    penerimaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: false,
    },

    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
  },
  { timestamps: true },
);
// Ini mempercepat pencarian "Tampilkan semua draft (PENDING) milik perusahaan X"
TransferStokSchema.index({ tenantID: 1, status: 1 });
// Mempercepat outlet saat ingin melihat "Barang apa saja yang sedang dikirim ke toko saya?"
TransferStokSchema.index({ keLocationID: 1, status: 1 });
// Mempercepat gudang pusat melihat riwayat pengiriman keluar
TransferStokSchema.index({ dariLocationID: 1 });
// Mempercepat pembuatan laporan bulanan atau pencarian berdasarkan rentang waktu
TransferStokSchema.index({ tanggalKirim: -1 });

module.exports = mongoose.model("TransferStok", TransferStokSchema);
