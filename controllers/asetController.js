const asetService = require("../services/asetService");
const createError = require("http-errors");

class AsetController {
  // --- CREATE ---
  async createAset(req, res, next) {
    try {
      /**
       * 🔐 KEAMANAN: Memastikan data aset terikat ke tenant yang login.
       * Payload tenantID dipaksa dari req.pengguna (hasil decode token).
       */
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
      };

      const newAset = await asetService.create(payload);

      res.status(201).json({
        success: true,
        message: "Aset berhasil ditambahkan",
        data: newAset,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ ALL ---
  async getAllAset(req, res, next) {
    try {
      // Mengambil tenantID dari identitas user (bukan query string yang bisa diubah)
      const tenantID = req.pengguna.tenantID;

      const asets = await asetService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: asets.length,
        data: asets,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ BY ID ---
  async getAsetById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      // Melakukan pengecekan detail aset dengan filter tenantID di level service
      const aset = await asetService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: aset,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- UPDATE ---
  async updateAset(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedAset = await asetService.update(id, tenantID, req.body);

      res.status(200).json({
        success: true,
        message: "Aset berhasil diperbarui",
        data: updatedAset,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deleteAset(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await asetService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AsetController();
