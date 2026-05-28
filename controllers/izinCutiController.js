const izinCutiService = require("../services/izinCutiService");
const createError = require("http-errors");

class IzinCutiController {
  _getRequesterTenantID(req) {
    return req.pengguna?.tenantID || null;
  }

  _getRequesterUserID(req) {
    return req.pengguna?._id || null;
  }

  async getAllOwn(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);

      const result = await izinCutiService.getAllByStaf(tenantID, userID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async createOwn(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);

      const payload = {
        ...req.body,
        tenantID: tenantID,
        penggunaID: userID,
        status: "diajukan",
        dicatatOleh: null,
        catatan: null,
      };

      const result = await izinCutiService.create(payload);
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({
        data: result,
        // --- PESAN PERINGATAN DITAMBAHKAN DI SINI ---
        message:
          "Pengajuan izin/cuti berhasil dikirim. Perhatian: Izin/cuti yang sudah diajukan bersifat permanen dan tidak dapat dihapus.",
      });
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      if (!tenantID)
        throw createError(403, "Akses ditolak. Tenant tidak valid.");

      const result = await izinCutiService.getAll(tenantID);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const result = await izinCutiService.getById(req.params.id, tenantID);

      if (!result)
        throw createError(404, "Data tidak ditemukan atau beda tenant");
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const payload = {
        ...req.body,
        tenantID: tenantID,
        dicatatOleh: null,
      };

      const result = await izinCutiService.create(payload);
      if (result?.error) return res.status(400).json({ errors: result.error });

      res.status(201).json({
        data: result,
        // (Opsional) Tambahkan peringatan juga untuk admin
        message:
          "Izin/Cuti staf berhasil dicatat. Data bersifat permanen dan tidak dapat dihapus.",
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const tenantID = this._getRequesterTenantID(req);
      const userID = this._getRequesterUserID(req);
      const payload = { ...req.body };

      if (payload.status) {
        payload.dicatatOleh = userID;
      }

      const result = await izinCutiService.update(
        req.params.id,
        payload,
        tenantID,
      );

      if (result?.error) return res.status(400).json({ errors: result.error });
      if (!result) throw createError(404, "Data tidak ditemukan");

      res.json({
        data: result,
        message: "Keputusan status berhasil diperbarui",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IzinCutiController();
