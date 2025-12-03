const RolePermission = require("../models/rolePermissionModel");
const redis = require("../config/redis");
const {
  validateAssignPermission,
} = require("../validators/rolePermissionValidator");
const createError = require("http-errors");

// CACHE KEYS
// cache permission berdasarkan Role, bukan per tenant,
// karena permission dicek saat user (dengan Role tertentu) login/beraksi.
const KEY_ROLE_PERMS = (roleID) => `role:permissions:${roleID}`;

class RolePermissionService {
  async assign(payload) {
    // Validasi
    const validation = validateAssignPermission(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      // Simpan ke DB
      const newAssign = await RolePermission.create(payload);

      // Invalidate Cache Role
      await redis.del(KEY_ROLE_PERMS(payload.roleID));

      return newAssign;
    } catch (err) {
      // Handle Duplicate
      if (err.code === 11000) {
        return { error: ["Permission ini sudah dimiliki oleh role tersebut"] };
      }
      throw err;
    }
  }

  async getByRole(roleID) {
    if (!roleID) throw createError(400, "Role ID required");

    const key = KEY_ROLE_PERMS(roleID);

    // Cek Cache
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // DB Query
    // populate permissionID agar frontend tahu nama permissionnya
    const permissions = await RolePermission.find({ roleID })
      .populate("permissionID", "nama grup deskripsi")
      .populate("roleID", "namaRole")
      .lean();

    // Set Cache (1 Jam)
    await redis.set(key, JSON.stringify(permissions), "EX", 3600);

    return permissions;
  }

  async getAll() {
    // tidak perlu cache berat di sini karena ini biasanya hanya untuk admin/debug
    // Tapi populate sangat penting agar datanya terbaca
    const allData = await RolePermission.find()
      .populate("roleID", "namaRole")
      .populate("permissionID", "nama grup deskripsi")
      .sort({ roleID: 1 }) // Urutkan berdasarkan Role agar rapi
      .lean();

    return allData;
  }

  async remove(id) {
    // Kita butuh cari dokumennya dulu untuk tahu roleID-nya (buat hapus cache)
    const assignment = await RolePermission.findById(id);
    if (!assignment) return null;

    await assignment.deleteOne();

    // Invalidate Cache
    await redis.del(KEY_ROLE_PERMS(assignment.roleID));

    return true;
  }
}

module.exports = new RolePermissionService();
