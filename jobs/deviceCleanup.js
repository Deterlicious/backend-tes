// src/jobs/deviceCleanup.js
const cron = require("node-cron");
const Device = require("../models/deviceModel");
const { DEVICE_STATUS } = require("../config/constants");

// Jadwalkan tugas berjalan setiap jam (menit ke-0)
// Format cron: '0 * * * *'
const startDeviceCleanupJob = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("[CRON] Memulai pembersihan perangkat pending yang kedaluwarsa...");
      
      const now = new Date();

      const result = await Device.updateMany(
        {
          status: DEVICE_STATUS.PENDING,
          pendingExpiresAt: { $lt: now }
        },
        {
          $set: { status: DEVICE_STATUS.EXPIRED }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`[CRON] Berhasil memperbarui ${result.modifiedCount} perangkat menjadi expired.`);
      } else {
        console.log("[CRON] Tidak ada perangkat kedaluwarsa yang perlu diperbarui.");
      }
    } catch (error) {
      console.error("[CRON] Terjadi kesalahan saat pembersihan perangkat:", error);
    }
  });
};

module.exports = startDeviceCleanupJob;