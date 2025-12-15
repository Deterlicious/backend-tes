const mongoose = require("mongoose");

const laporanBulananSchema = new mongoose.Schema(
  {
    laporanBulananID: {
      type: String,
      required: true,
      unique: true, // Contoh format: LPH-tenantID-YYYYMM
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Tenant", // Asumsi ada model Tenant
      index: true,
    },
    bulan: {
      type: Number,
      required: true,
      min: 1,
      max: 12, // Misal: 10 untuk Oktober
    },
    tahun: {
      type: Number,
      required: true, // Misal: 2025
    }, // Index gabungan untuk unique per bulan per tahun per tenant
    uniqueIndex: {
      tenantID: { type: mongoose.Schema.Types.ObjectId, required: true },
      bulan: { type: Number, required: true },
      tahun: { type: Number, required: true },
    },
    jumlahTransaksi: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.jumlahTransaksi)
    },
    totalOmzet: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.totalOmzet)
    },
    totalHPP: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.totalHPP)
    },
    totalLabaKotor: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.totalLabaKotor)
    },
    totalBebanOperasional: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.totalBebanOperasional)
    },
    totalLabaBersih: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.totalLabaBersih)
    },
    totalUangKeluarBulanan: {
      type: Number,
      default: 0, // Dihitung: SUM(LaporanHarian.totalUangKeluar)
    },
  },
  {
    timestamps: true,
  }
);

// Mongoose Index untuk memastikan laporan unik per bulan per tahun per tenant
laporanBulananSchema.index(
  { tenantID: 1, bulan: 1, tahun: 1 },
  { unique: true }
);

const LaporanBulanan = mongoose.model("LaporanBulanan", laporanBulananSchema);

module.exports = LaporanBulanan;
