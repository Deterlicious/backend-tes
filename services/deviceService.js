const Device = require("../models/deviceModel");
const { DEVICE_STATUS } = require("../config/constants");
const createError = require("http-errors");

class DeviceService {
  // 1. MENDAPATKAN DAFTAR PERANGKAT
  // REVISI MULTI-TENANCY: Menambahkan parameter tenantID
  async getDevices(userId, tenantID) {
    if (!userId || !tenantID) {
      throw createError(
        400,
        "Parameter tidak lengkap untuk mengambil data perangkat.",
      );
    }

    // REVISI MULTI-TENANCY: Gembok pengaman lintas penyewa.
    // Memastikan kasir/user yang dicari mutlak merupakan bagian dari tenant pemohon.
    const mongoose = require("mongoose");
    const penggunaSah = await mongoose
      .model("Pengguna")
      .findOne({ _id: userId, tenantID });

    if (!penggunaSah) {
      throw createError(
        404,
        "Perangkat tidak ditemukan atau Anda tidak memiliki hak akses.",
      );
    }

    // Mengambil data perangkat, diurutkan dari yang paling baru berinteraksi.
    // Keamanan Kritis: TIDAK BOLEH mengembalikan refreshTokenHash ke frontend.
    const devices = await Device.find({ penggunaID: userId })
      .select("-refreshTokenHash -__v")
      .sort({ lastSeenAt: -1, createdAt: -1 })
      .lean();

    return devices;
  }

  // 2. MENYETUJUI PERANGKAT (APPROVE)
  // REVISI MULTI-TENANCY: Menambahkan parameter tenantID di destrukturisasi objek
  async approveDevice({ installationId, approvedByUserId, tenantID }) {
    if (!installationId || !approvedByUserId || !tenantID) {
      throw createError(
        400,
        "Parameter tidak lengkap untuk melakukan persetujuan.",
      );
    }

    // REVISI MULTI-TENANCY: Populate relasi Pengguna untuk mengintip bendera toko (tenantID)
    const device = await Device.findOne({ installationId }).populate(
      "penggunaID",
    );

    // Gembok Isolasi Data: Pastikan perangkat ada DAN kasir tersebut bernaung di bawah tenant yang sama
    if (
      !device ||
      !device.penggunaID ||
      device.penggunaID.tenantID.toString() !== tenantID.toString()
    ) {
      throw createError(404, "Perangkat tidak ditemukan di dalam sistem.");
    }

    if (device.status === DEVICE_STATUS.TRUSTED) {
      throw createError(400, "Perangkat ini sudah memiliki status Trusted.");
    }

    if (device.status === DEVICE_STATUS.REVOKED) {
      throw createError(
        403,
        "Perangkat yang telah dicabut (Revoked) tidak dapat disetujui ulang demi keamanan. Kasir harus menginstal ulang aplikasi.",
      );
    }

    // Validasi Keamanan Ganda: Cek Limit Kuota
    // Untuk berjaga-jaga jika Owner menyetujui banyak perangkat sekaligus melebihi batas.
    const maxDevices = parseInt(process.env.MAX_DEVICES_PER_USER, 10) || 3;
    const activeDeviceCount = await Device.countDocuments({
      penggunaID: device.penggunaID,
      status: DEVICE_STATUS.TRUSTED,
    });

    if (activeDeviceCount >= maxDevices) {
      throw createError(
        403,
        `Tidak dapat menyetujui perangkat. Kuota maksimal (${maxDevices}) untuk kasir ini telah penuh. Revoke perangkat lain terlebih dahulu.`,
      );
    }

    // Eksekusi Persetujuan
    device.status = DEVICE_STATUS.TRUSTED;
    device.approvedBy = approvedByUserId;
    device.approvedAt = new Date();
    device.pendingExpiresAt = undefined; // Bersihkan masa kedaluwarsa

    await device.save();

    // Hapus hash agar aman dikembalikan sebagai respons
    const safeDevice = device.toObject();
    delete safeDevice.refreshTokenHash;

    return safeDevice;
  }

  // 3. MENCABUT AKSES PERANGKAT (REVOKE)
  async revokeDevice({ installationId, revokedByUserId, tenantID }) {
    // REVISI MULTI-TENANCY: Mewajibkan parameter tenantID di awal
    if (!installationId || !revokedByUserId || !tenantID) {
      throw createError(400, "Parameter tidak lengkap untuk pencabutan akses.");
    }

    // REVISI MULTI-TENANCY: Populate relasi Pengguna untuk memverifikasi isolasi toko
    const device = await Device.findOne({ installationId }).populate(
      "penggunaID",
    );

    // Gembok Isolasi Data: Blokir total manipulasi lintas tenant
    if (
      !device ||
      !device.penggunaID ||
      device.penggunaID.tenantID.toString() !== tenantID.toString()
    ) {
      throw createError(404, "Perangkat tidak ditemukan.");
    }

    if (device.status === DEVICE_STATUS.REVOKED) {
      // REVISI KONSISTENSI: Pastikan hash terbuang bahkan saat merespons skenario idempotent
      const safeDevice = device.toObject();
      delete safeDevice.refreshTokenHash;
      return safeDevice;
    }

    // Eksekusi Pencabutan dan Pemutusan Sesi Paksa
    device.status = DEVICE_STATUS.REVOKED;
    device.refreshTokenHash = null; // Menghancurkan rantai perpanjangan token

    // REVISI: Mencatat jejak audit (Audit Trail)
    device.revokedBy = revokedByUserId;
    device.revokedAt = new Date();

    await device.save();

    // CACHE INVALIDATION INSTAN
    // Ini adalah baris terpenting. Jika kasir sedang memegang tabletnya saat Owner
    // menekan tombol Revoke, tablet tersebut akan langsung terkunci pada request berikutnya.
    if (global.deviceCache) {
      global.deviceCache.del(`${device.penggunaID}:${installationId}`);
    }

    // Hapus hash sebelum dikirim sebagai respons
    const safeDevice = device.toObject();
    delete safeDevice.refreshTokenHash;

    return safeDevice;
  }

  // 4 PERSETUJUAN MANDIRI (SELF-APPROVE)
  async selfApproveDevice({ installationId, penggunaId }) {
    if (!installationId || !penggunaId) {
      throw createError(
        400,
        "Parameter tidak lengkap untuk persetujuan mandiri.",
      );
    }

    // KUNCI KEAMANAN: cari perangkat dengan mencocokkan 'penggunaID'.
    // Ini mencegah serangan manipulasi ID di mana Budi mencoba menyetujui HP Siti.
    const device = await Device.findOne({
      installationId,
      penggunaID: penggunaId,
    });

    if (!device) {
      throw createError(404, "Perangkat tidak ditemukan di antrean Anda.");
    }

    if (device.status === DEVICE_STATUS.TRUSTED) {
      throw createError(400, "Perangkat ini sudah memiliki status Trusted.");
    }

    if (device.status === DEVICE_STATUS.REVOKED) {
      throw createError(
        403,
        "Perangkat yang telah dicabut tidak dapat disetujui ulang.",
      );
    }

    // Validasi Limit Kuota
    const maxDevices = parseInt(process.env.MAX_DEVICES_PER_USER, 10) || 3;
    const activeDeviceCount = await Device.countDocuments({
      penggunaID: penggunaId,
      status: DEVICE_STATUS.TRUSTED,
    });

    if (activeDeviceCount >= maxDevices) {
      throw createError(
        403,
        `Tidak dapat menyetujui. Kuota maksimal (${maxDevices}) penuh. Revoke perangkat lama Anda terlebih dahulu.`,
      );
    }

    // Eksekusi Persetujuan Mandiri
    device.status = DEVICE_STATUS.TRUSTED;
    device.approvedBy = penggunaId; // Stempel bahwa ia menyetujuinya sendiri
    device.approvedAt = new Date();
    device.pendingExpiresAt = undefined;

    await device.save();

    // Hapus hash agar aman dikembalikan ke klien (Flutter)
    const safeDevice = device.toObject();
    delete safeDevice.refreshTokenHash;

    return safeDevice;
  }
}

module.exports = new DeviceService();
