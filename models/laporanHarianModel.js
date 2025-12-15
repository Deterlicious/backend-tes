const mongoose = require("mongoose");

const laporanHarianSchema = new mongoose.Schema(
  {
    laporanHarianID: {
      type: String,
      required: true,
      unique: true, // Contoh format: LPH-tenantID-YYYYMMDD
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Tenant", // Asumsi ada model Tenant
      index: true,
    },
    tanggal: {
      type: Date,
      required: true,
      index: true,
    }, // Digunakan untuk memastikan laporan per tanggal hanya 1 per tenant // Index gabungan untuk unique per hari per tenant
    uniqueIndex: {
      tenantID: { type: mongoose.Schema.Types.ObjectId, required: true },
      tanggal: { type: Date, required: true },
    },
    jumlahTransaksi: {
      type: Number,
      default: 0,
    },
    totalPenjualanKotor: {
      type: Number,
      default: 0,
    },
    totalDiskon: {
      type: Number,
      default: 0,
    },
    totalOmzet: {
      type: Number,
      default: 0, // Dihitung: totalPenjualanKotor - totalDiskon
    },
    totalHPP: {
      type: Number,
      default: 0, // Dihitung: Kalulasi Mahal dari resep
    },
    totalLabaKotor: {
      type: Number,
      default: 0, // Dihitung: totalOmzet - totalHPP
    },
    totalBebanOperasional: {
      type: Number,
      default: 0,
    },
    totalLabaBersih: {
      type: Number,
      default: 0, // Dihitung: totalLabaKotor - totalBebanOperasional (KPI Utama)
    },
    totalUangMasuk: {
      type: Number,
      default: 0, // Dihitung: SUM(jumlahBayar - kembalian) dari Pembayaran
    },
    totalUangKeluar: {
      type: Number,
      default: 0, // Dihitung: SUM(BebanOperasional) + SUM(PembelianStok)
    },
  },
  {
    timestamps: true,
  }
);

// Mongoose Index untuk memastikan laporan unik per tanggal per tenant
laporanHarianSchema.index({ tenantID: 1, tanggal: 1 }, { unique: true });

const LaporanHarian = mongoose.model("LaporanHarian", laporanHarianSchema);

module.exports = LaporanHarian;
