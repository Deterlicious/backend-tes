const izinCutiService = require("../services/izinCutiService");
const createError = require("http-errors");

class IzinCutiController {
  /**
   * ✅ CREATE: Tambah Izin Cuti
   * tenantID dan dicatatOleh diambil otomatis dari token.
   */
  async createIzinCuti(req, res, next) {
    try {
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID, // Otomatis dari middleware
        dicatatOleh: req.pengguna._id, // ID akun yang sedang login
      };

      // console.log("Payload yang dikirim ke Service:", payload); // cek isi payload
      const newIzinCuti = await izinCutiService.create(payload);

      res.status(201).json({
        success: true,
        message: "Izin/Cuti berhasil dicatat",
        data: newIzinCuti,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ READ ALL: Filter berdasarkan tenant pengguna
   */
  async getAllIzinCuti(req, res, next) {
    try {
      const tenantID = req.pengguna.tenantID;
      const data = await izinCutiService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: data.length,
        data: data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ READ BY ID: Detail Izin Cuti
   * Keamanan: Memastikan ID data sesuai dengan tenantID pengguna
   */
  async getIzinCutiById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const izinCuti = await izinCutiService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: izinCuti,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ UPDATE: Perbarui data Izin Cuti
   */
  async updateIzinCuti(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updated = await izinCutiService.update(id, tenantID, req.body);

      res.status(200).json({
        success: true,
        message: "Data berhasil diperbarui",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ✅ DELETE: Hapus data Izin Cuti
   */
  async deleteIzinCuti(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await izinCutiService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IzinCutiController();
