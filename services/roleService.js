const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
const redis = require("../config/redis");
const { validateRolePayload } = require("../validators/roleValidator");
const createError = require("http-errors");
const mongoose = require("mongoose");
const Pengguna = require("../models/penggunaModel");

// CACHE KEYS
const KEY_LIST = (tenantID) => `role:list:${tenantID}`;
const KEY_DETAIL = (id) => `role:detail:${id}`;

class RoleService {
  // STRICT PERMISSION PROCESSOR
  async _processPermissions(permissionsArray) {
    if (!Array.isArray(permissionsArray)) {
      throw createError(400, "Field 'permissions' harus berupa array");
    }

    if (permissionsArray.length === 0) {
      throw createError(400, "Field 'permissions' tidak boleh kosong");
    }

    const objectIds = [];
    const slugs = [];

    for (const item of permissionsArray) {
      // OBJECT ID VALIDATION + EXISTENCE CHECK (FIX)
      if (mongoose.Types.ObjectId.isValid(item)) {
        const exists = await Permission.findById(item).lean();

        if (!exists) {
          throw createError(400, `Permission ID tidak ditemukan: ${item}`);
        }

        objectIds.push(item.toString());
      }

      // SLUG / NAME VALIDATION
      else if (typeof item === "string" && item.trim() !== "") {
        slugs.push(item.trim());
      } else {
        throw createError(400, "Format permission tidak valid");
      }
    }

    let foundIds = [];

    // LOOKUP BY NAME (SLUG)
    if (slugs.length > 0) {
      const foundPermissions = await Permission.find(
        { nama: { $in: slugs } },
        "_id nama",
      ).lean();

      const foundNames = foundPermissions.map((p) => p.nama);
      const missing = slugs.filter((s) => !foundNames.includes(s));

      if (missing.length > 0) {
        throw createError(
          400,
          `Permission tidak ditemukan: ${missing.join(", ")}`,
        );
      }

      foundIds = foundPermissions.map((p) => p._id.toString());
    }

    // FINAL UNIQUE RESULT
    return [...new Set([...objectIds, ...foundIds])];
  }

  // GET ALL
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

  // GET BY ID
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

  // CREATE ROLE (STRICT)
  async create(payload, tenantID) {
    payload.tenantID = tenantID;

    const validation = validateRolePayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    // STRICT CHECK
    if (!Array.isArray(payload.permissions) || payload.permissions.length < 1) {
      throw createError(400, "Field 'permissions' wajib diisi minimal 1");
    }

    // PROTEKSI RESERVED KEYWORD
    if (payload.namaRole.trim().toLowerCase() === "owner") {
      throw createError(
        403,
        "Nama role 'Owner' dilindungi oleh sistem dan tidak dapat dibuat secara manual.",
      );
    }

    payload.permissions = await this._processPermissions(payload.permissions);

    const role = await Role.create(payload);

    await redis.del(KEY_LIST(tenantID));

    return role;
  }

  // OWNER ROLE
  async createOwnerRole(tenantID) {
    const existingOwner = await Role.findOne({
      tenantID,
      namaRole: "Owner",
    }).lean();
    if (existingOwner) {
      return existingOwner; // Langsung kembalikan data lama tanpa membuat baru
    }
    const allPermissions = await Permission.find().select("_id").lean();

    if (!allPermissions.length) {
      throw createError(500, "System permission kosong");
    }

    const role = await Role.create({
      tenantID,
      namaRole: "Owner",
      deskripsi: "Role sistem dengan akses penuh",
      permissions: allPermissions.map((p) => p._id),
    });

    await redis.del(KEY_LIST(tenantID));

    return role;
  }

  // UPDATE ROLE
  async update(id, payload, tenantID) {
    delete payload.tenantID;

    const validation = validateRolePayload(payload, true);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    const currentRole = await Role.findOne({ _id: id, tenantID });
    if (!currentRole) {
      throw createError(404, "Role tidak ditemukan");
    }

    // 🔥 PROTEKSI HIJACKING NAMA ROLE
    if (
      payload.namaRole &&
      payload.namaRole.trim().toLowerCase() === "owner" &&
      currentRole.namaRole !== "Owner"
    ) {
      throw createError(
        403,
        "Tidak dapat menggunakan nama 'Owner' karena dilindungi oleh sistem.",
      );
    }

    if (
      currentRole.namaRole === "Owner" &&
      payload.namaRole &&
      payload.namaRole !== "Owner"
    ) {
      throw createError(403, "Owner tidak boleh diubah");
    }

    if (currentRole.namaRole === "Owner" && payload.permissions) {
      throw createError(403, "Owner permissions tidak boleh diubah");
    }

    if (payload.permissions) {
      payload.permissions = await this._processPermissions(payload.permissions);
    }

    Object.assign(currentRole, payload);

    const updated = await currentRole.save();
    await updated.populate("permissions", "nama grup");

    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_DETAIL(id));

    // Invalidate cache otorisasi milik semua pengguna yang memakai role ini
    const affectedUsers = await Pengguna.find({ roleID: id, tenantID })
      .select("_id")
      .lean();
    if (affectedUsers.length > 0) {
      const cacheKeys = affectedUsers.map(
        (user) => `auth:pengguna:${user._id}`,
      );
      // Hapus semua cache sesi pengguna yang terpengaruh agar mereka dipaksa
      // mengambil data permission terbaru dari database pada request berikutnya
      const deletePromises = cacheKeys.map((key) => redis.del(key));
      await Promise.all(deletePromises);
    }

    return updated;
  }

  // DELETE ROLE
  async delete(id, tenantID) {
    const role = await Role.findOne({ _id: id, tenantID });

    if (!role) throw createError(404, "Role tidak ditemukan");

    if (role.namaRole === "Owner") {
      throw createError(403, "Owner tidak dapat dihapus");
    }

    const isUsed = await Pengguna.exists({ roleID: id, tenantID });
    if (isUsed) {
      throw createError(
        409,
        "Role tidak dapat dihapus karena masih terikat pada pengguna aktif.",
      );
    }

    await role.deleteOne();

    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_DETAIL(id));

    return true;
  }
}

module.exports = new RoleService();
