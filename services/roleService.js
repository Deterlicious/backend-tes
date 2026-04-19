const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
const redis = require("../config/redis");
const { validateRolePayload } = require("../validators/roleValidator");
const createError = require("http-errors");
const mongoose = require("mongoose");

// CACHE KEYS
const KEY_LIST = (tenantID) => `role:list:${tenantID}`;
const KEY_DETAIL = (id) => `role:detail:${id}`;

class RoleService {

  /**
   * 🔥 SMART FUNCTION:
   * Mengubah array permission (slug / ObjectId) menjadi ObjectId valid
   */
  async _processPermissions(permissionsArray) {
    if (!permissionsArray || !Array.isArray(permissionsArray)) return permissionsArray;

    const objectIds = [];
    const slugs = [];

    // Pisahkan ID & slug
    for (const item of permissionsArray) {
      if (mongoose.Types.ObjectId.isValid(item)) {
        objectIds.push(item.toString());
      } else if (typeof item === "string") {
        slugs.push(item.trim());
      }
    }

    let foundIds = [];

    // Ambil ID dari slug
    if (slugs.length > 0) {
      const foundPermissions = await Permission.find(
        { nama: { $in: slugs } },
        "_id"
      ).lean();

      if (foundPermissions.length !== slugs.length) {
        throw createError(400, "Satu atau lebih nama Permission tidak dikenali.");
      }

      foundIds = foundPermissions.map((p) => p._id.toString());
    }

    // Remove duplicate
    const finalPermissions = [...new Set([...objectIds, ...foundIds])];

    return finalPermissions;
  }

  // ==========================================
  // GET ALL ROLES
  // ==========================================
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID required");

    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const roles = await Role.find({ tenantID })
      .populate("permissions", "nama grup")
      .sort({ namaRole: 1 })
      .lean();

    await redis.set(KEY_LIST(tenantID), JSON.stringify(roles), "EX", 3600);

    return roles;
  }

  // ==========================================
  // GET ROLE BY ID
  // ==========================================
  async getById(id, tenantID) {
    const cached = await redis.get(KEY_DETAIL(id));

    if (cached) {
      const parsed = JSON.parse(cached);

      if (parsed.tenantID !== tenantID.toString()) {
        throw createError(403, "Akses lintas tenant ditolak");
      }

      return parsed;
    }

    const role = await Role.findOne({ _id: id, tenantID })
      .populate("permissions", "nama grup")
      .lean();

    if (!role) throw createError(404, "Role tidak ditemukan");

    await redis.set(KEY_DETAIL(id), JSON.stringify(role), "EX", 3600);

    return role;
  }

  // ==========================================
  // CREATE ROLE
  // ==========================================
  async create(payload, tenantID) {
    payload.tenantID = tenantID;

    const validation = validateRolePayload(payload);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    if (payload.permissions) {
      payload.permissions = await this._processPermissions(payload.permissions);
    }

    try {
      const role = await Role.create(payload);

      await redis.del(KEY_LIST(tenantID));

      return role;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(409, "Nama role sudah digunakan di tenant ini.");
      }
      throw err;
    }
  }

  // ==========================================
  // CREATE OWNER ROLE (SYSTEM)
  // ==========================================
  async createOwnerRole(tenantID) {
    const allPermissions = await Permission.find().select("_id").lean();
    const permissionIds = allPermissions.map((p) => p._id);

    const payload = {
      tenantID,
      namaRole: "Owner",
      deskripsi: "Role sistem dengan akses penuh",
      permissions: permissionIds,
    };

    const role = await Role.create(payload);

    await redis.del(KEY_LIST(tenantID));

    return role;
  }

  // ==========================================
  // UPDATE ROLE
  // ==========================================
  async update(id, payload, tenantID) {
    delete payload.tenantID;

    const validation = validateRolePayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const currentRole = await Role.findOne({ _id: id, tenantID });
    if (!currentRole) throw createError(404, "Role tidak ditemukan");

    // 🔥 PROTEKSI OWNER (NAMA)
    if (
      currentRole.namaRole === "Owner" &&
      payload.namaRole &&
      payload.namaRole !== "Owner"
    ) {
      throw createError(403, "Nama Role Owner tidak boleh diubah");
    }

    // 🔥 PROTEKSI OWNER (PERMISSION)
    if (currentRole.namaRole === "Owner" && payload.permissions) {
      throw createError(403, "Permission Role Owner tidak boleh diubah");
    }

    // Proses permission jika ada
    if (payload.permissions) {
      payload.permissions = await this._processPermissions(payload.permissions);
    }

    Object.assign(currentRole, payload);

    try {
      const updated = await currentRole.save();
      await updated.populate("permissions", "nama grup");

      await redis.del(KEY_LIST(tenantID));
      await redis.del(KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(409, "Nama role sudah digunakan di tenant ini.");
      }
      throw err;
    }
  }

  // ==========================================
  // DELETE ROLE
  // ==========================================
  async delete(id, tenantID) {
    const role = await Role.findOne({ _id: id, tenantID });

    if (!role) throw createError(404, "Role tidak ditemukan");

    // 🔥 PROTEKSI OWNER
    if (role.namaRole === "Owner") {
      throw createError(403, "Role Owner tidak dapat dihapus");
    }

    await role.deleteOne();

    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_DETAIL(id));

    return true;
  }
}

module.exports = new RoleService();