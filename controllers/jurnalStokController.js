const jurnalStokService = require("../services/jurnalStokService");
const createError = require("http-errors");

class JurnalStokController {
  /**
   * ✅ CREATE: Tambah Jurnal Stok
   * tenantID dan dicatatOleh (jika ada) diambil otomatis dari token.
   */
  async createJurnalStok(req, res, next) {
    try {
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID, // Injeksi otomatis dari token
        dicatatOleh: req.pengguna.id || req.pengguna._id,
      };

      const newJurnal = await jurnalStokService.create(payload);

      res.status(201).json({
        success: true,
        message: "Jurnal Stok berhasil ditambahkan",
        data: newJurnal,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ READ ALL: Filter berdasarkan tenant pengguna
   */
  async getAllJurnalStok(req, res, next) {
    try {
      const tenantID = req.pengguna.tenantID;
      const jurnalStok = await jurnalStokService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: jurnalStok.length,
        data: jurnalStok,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ READ BY ID: Detail Jurnal Stok
   * Keamanan: Validasi bahwa data yang diminta milik tenant yang login
   */
  async getJurnalStokById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const jurnalStok = await jurnalStokService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: jurnalStok,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ UPDATE: Perbarui Jurnal Stok
   */
  async updateJurnalStok(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedJurnal = await jurnalStokService.update(
        id,
        tenantID,
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Jurnal Stok berhasil diperbarui",
        data: updatedJurnal,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ DELETE: Hapus Jurnal Stok
   */
  async deleteJurnalStok(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await jurnalStokService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new JurnalStokController();
