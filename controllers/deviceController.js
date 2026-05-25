// src/controllers/deviceController.js

const deviceService = require("../services/deviceService");
const {
  validateDeviceAction,
  validateGetDevices,
} = require("../validators/deviceValidator");
const createError = require("http-errors");

class DeviceController {
  // 1. GET DEVICES (Mendapatkan Daftar Perangkat)
  async getDevices(req, res, next) {
    try {
      // Mengambil userId dari parameter URL (misal: GET /api/devices/:userId)
      const userId = req.params.userId;

      // REVISI MULTI-TENANCY: Ekstraksi tenantID dari sesi token pengguna yang login
      const tenantID = req.pengguna?.tenantID;
      if (!tenantID) {
        throw createError(
          401,
          "Akses ditolak. Sesi identitas toko tidak ditemukan.",
        );
      }

      // 1. Eksekusi Validator
      const { valid, errors } = validateGetDevices({ userId });
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "Validasi permintaan gagal.",
          errors,
        });
      }

      // 2. Lempar ke Service dengan menyertakan perlindungan tenantID
      const devices = await deviceService.getDevices(userId, tenantID);

      // 3. Kirim Respon
      res.status(200).json({
        success: true,
        message: "Daftar perangkat berhasil diambil.",
        data: devices,
      });
    } catch (err) {
      next(err); // meneruskan error ke global error handler
    }
  }

  // 2. APPROVE DEVICE (Menyetujui Perangkat)
  async approveDevice(req, res, next) {
    try {
      // 1. Eksekusi Validator
      const { valid, errors } = validateDeviceAction(req.body);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "Validasi permintaan gagal.",
          errors,
        });
      }

      // 2. Ekstraksi Identitas Owner (Pemberi Izin)
      const approvedByUserId = req.pengguna?.id || req.pengguna?._id;
      if (!approvedByUserId) {
        throw createError(
          401,
          "Akses ditolak. Sesi identitas tidak ditemukan.",
        );
      }

      // REVISI MULTI-TENANCY: Amankan token tenantID milik pemohon
      const tenantID = req.pengguna?.tenantID;
      if (!tenantID) {
        throw createError(
          401,
          "Akses ditolak. Sesi identitas toko tidak ditemukan.",
        );
      }

      // 3. Lempar ke Service dengan menyertakan tameng tenantID
      const result = await deviceService.approveDevice({
        installationId: req.body.installationId,
        approvedByUserId,
        tenantID, // Ditambahkan ke payload destrukturisasi
      });

      res.status(200).json({
        success: true,
        message:
          "Perangkat berhasil disetujui dan kini memiliki status Trusted.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. REVOKE DEVICE (Mencabut Akses Perangkat)
  // 3. REVOKE DEVICE (Mencabut Akses Perangkat)
  async revokeDevice(req, res, next) {
    try {
      // 1. Eksekusi Validator
      const { valid, errors } = validateDeviceAction(req.body);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "Validasi permintaan gagal.",
          errors,
        });
      }

      // 2. Ekstraksi Identitas Owner/Manajer yang mencabut izin
      const revokedByUserId = req.pengguna?.id || req.pengguna?._id;
      if (!revokedByUserId) {
        throw createError(
          401,
          "Akses ditolak. Sesi identitas tidak ditemukan.",
        );
      }

      // REVISI MULTI-TENANCY: Amankan token tenantID milik pemohon
      const tenantID = req.pengguna?.tenantID;
      if (!tenantID) {
        throw createError(
          401,
          "Akses ditolak. Sesi identitas toko tidak ditemukan.",
        );
      }

      // 3. Lempar ke Service beserta jejak audit dan tameng tenantID
      const result = await deviceService.revokeDevice({
        installationId: req.body.installationId,
        revokedByUserId,
        tenantID, // Menyuntikkan kontrol isolasi data
      });

      res.status(200).json({
        success: true,
        message:
          "Akses perangkat berhasil dicabut. Sesi telah diputus secara paksa.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 4 SELF-APPROVE DEVICE
  async selfApproveDevice(req, res, next) {
    try {
      // 1. Eksekusi Validator (bisa gunakan validator yang sama
      // karena payload-nya sama: hanya butuh installationId)
      const { valid, errors } = validateDeviceAction(req.body);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "Validasi permintaan gagal.",
          errors,
        });
      }

      // 2. Ekstraksi Identitas Pemohon (Budi / Karyawan)
      // Middleware authPengguna V1 letakkan ID di req.pengguna
      const penggunaId = req.pengguna?.id || req.pengguna?._id;

      if (!penggunaId) {
        throw createError(401, "Akses ditolak. Sesi identitas tidak valid.");
      }

      // 3. Lempar ke Service dengan menyertakan penggunaId
      // Ini akan memicu gembok keamanan di Service agar Budi hanya bisa menyetujui HP miliknya sendiri
      const result = await deviceService.selfApproveDevice({
        installationId: req.body.installationId,
        penggunaId,
      });

      // 4. Kirim Respons Berhasil
      res.status(200).json({
        success: true,
        message: "Perangkat baru Anda berhasil disetujui secara mandiri.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DeviceController();
