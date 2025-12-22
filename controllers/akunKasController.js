const akunKasService = require("../services/akunKasService");
const createError = require("http-errors");

class AkunKasController {
  // --- CREATE ---
  async createAkunKas(req, res, next) {
    try {
      /**
       * KEAMANAN: Memaksa tenantID dari token (req.pengguna).
       * Mencegah user menyuntikkan data ke tenant orang lain.
       */
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };

      const newAkunKas = await akunKasService.create(payload);

      res.status(201).json({
        success: true,
        message: "Akun Kas berhasil ditambahkan",
        data: newAkunKas,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ ALL ---
  async getAllAkunKas(req, res, next) {
    try {
      // Mengambil tenantID dari token, bukan dari query string (lebih aman)
      const tenantID = req.pengguna.tenantID;

      const akunKas = await akunKasService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: akunKas.length,
        data: akunKas,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ BY ID ---
  async getAkunKasById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      // Passing tenantID ke service untuk memastikan isolasi data
      const akunKas = await akunKasService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: akunKas,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- UPDATE ---
  async updateAkunKas(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedAkunKas = await akunKasService.update(
        id,
        tenantID,
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Akun Kas berhasil diperbarui",
        data: updatedAkunKas,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deleteAkunKas(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await akunKasService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AkunKasController();
