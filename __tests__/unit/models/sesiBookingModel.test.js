const mongoose = require("mongoose");
const SesiBooking = require("../../../models/sesiBookingModel");

// Skenario A (Durasi menit dihitung otomatis dari waktuMulai & waktuSelesai)
test("durasiMenit harus dihitung otomatis dari selisih waktu", async () => {
  const sesi = new SesiBooking({
    tenantID: new mongoose.Types.ObjectId(),
    dataPengguna: new mongoose.Types.ObjectId(),
    dataPelanggan: new mongoose.Types.ObjectId(),
    dataAset: new mongoose.Types.ObjectId(),
    dataPenjualan: new mongoose.Types.ObjectId(),
    dataTarif: new mongoose.Types.ObjectId(),
    waktuMulai: new Date("2026-03-24T10:00:00Z"),
    waktuSelesai: new Date("2026-03-24T11:30:00Z"),
  });

  await sesi.save();

  expect(sesi.durasiMenit).toBe(90); // 1.5 jam = 90 menit
});
