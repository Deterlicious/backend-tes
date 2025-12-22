const absensiService = require("../services/absensiService");
const createError = require("http-errors");

class AbsensiController {
  // --- CREATE ---
  async createAbsensi(req, res, next) {
    try {
      /**
       * SINKRONISASI: Menggunakan req.pengguna sesuai standar middleware authPengguna.
       * Keamanan: tenantID dan penggunaID dipaksa diambil dari token (bukan body).
       */
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
        penggunaID: req.pengguna._id,
      };

      const result = await absensiService.create(payload);

      res.status(201).json({
        success: true,
        message: "Absensi berhasil dibuat",
        data: result,
      });
    } catch (err) {
      next(err); // Error dari service (createError) akan otomatis ditangkap di sini
    }
  }

  // --- GET ALL ---
  async getAllAbsensi(req, res, next) {
    try {
      // Isolasi data: Mengambil tenantID dari identitas pengguna yang terverifikasi
      const tenantID = req.pengguna.tenantID;

      const absensi = await absensiService.getAll(tenantID);

      res.json({
        success: true,
        message: "Data absensi berhasil diambil",
        total: absensi.length,
        data: absensi,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- GET BY ID ---
  async getAbsensiById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const absensi = await absensiService.getById(id, tenantID);

      // Jika service tidak throw error tapi data kosong, pastikan 404 tetap terjaga
      if (!absensi) {
        throw createError(404, "Data absensi tidak ditemukan.");
      }

      res.json({
        success: true,
        data: absensi,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- UPDATE ---
  async updateAbsensi(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updated = await absensiService.update(id, tenantID, req.body);

      res.json({
        success: true,
        message: "Absensi berhasil diperbarui",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deleteAbsensi(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      await absensiService.delete(id, tenantID);

      res.json({
        success: true,
        message: "Data absensi berhasil dihapus",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AbsensiController();
