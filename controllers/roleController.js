const roleService = require("../services/roleService");
const createError = require("http-errors");

class RoleController {
  /**
   * Helper Context: Mengambil data identitas dari token JWT (Internal Only)
   */
  _getRequesterContext(req) {
    if (req.pengguna) return { tenantID: req.pengguna.tenantID };
    if (req.akun) return { tenantID: req.akun.tenantID };
    if (req.akunContext) return { tenantID: req.akunContext.tenantID };
    return null;
  }

  // 1. GET ALL ROLES
  async getAll(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context?.tenantID) throw createError(403, "Tenant context tidak ditemukan.");

      const result = await roleService.getAll(context.tenantID);
      
      const formatted = result.map(r => ({
        // 1. Identitas Utama
        _id: r._id,
        // 2. Informasi Role
        namaRole: r.namaRole,
        deskripsi: r.deskripsi,
        // 3. Daftar Nama Permission
        permissions: r.permissions ? r.permissions.map(p => p.nama) : []
      }));

      res.json({ 
        message: "Daftar role berhasil diambil.",
        total: formatted.length,
        data: formatted 
      });
    } catch (err) {
      next(err);
    }
  }

  // 2. GET BY ID
  async getById(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const r = await roleService.getById(req.params.id, context.tenantID);

      res.json({ 
        message: "Detail role berhasil diambil.",
        data: {
          _id: r._id,
          namaRole: r.namaRole,
          deskripsi: r.deskripsi,
          permissions: r.permissions.map(p => p.nama)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. CREATE ROLE
  async create(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const result = await roleService.create(req.body, context.tenantID);
      
      // Populate agar muncul nama permission setelah create
      await result.populate("permissions", "nama");

      res.status(201).json({
        message: "Role berhasil dibuat.",
        data: {
          _id: result._id,
          namaRole: result.namaRole,
          deskripsi: result.deskripsi,
          permissions: result.permissions.map(p => p.nama)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. UPDATE ROLE
  async update(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const result = await roleService.update(req.params.id, req.body, context.tenantID);

      res.json({
        message: "Role berhasil diperbarui.",
        data: {
          _id: result._id,
          namaRole: result.namaRole,
          deskripsi: result.deskripsi,
          permissions: result.permissions.map(p => p.nama)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. DELETE ROLE
  async delete(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      await roleService.delete(req.params.id, context.tenantID);

      res.json({ message: "Role berhasil dihapus." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RoleController();