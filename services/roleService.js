const Role = require("../models/roleModel");
const redis = require("../config/redis");
const { validateRolePayload } = require("../validators/roleValidator");
const createError = require("http-errors");

// CACHE KEYS
const KEY_LIST = (tenantID) => `role:list:${tenantID}`;
const KEY_DETAIL = (id) => `role:detail:${id}`;

class RoleService {
  
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID required");

    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const roles = await Role.find({ tenantID })
      .sort({ namaRole: 1 }) 
      .lean();

    if (roles.length > 0) {
      await redis.set(KEY_LIST(tenantID), JSON.stringify(roles), "EX", 3600);
    }

    return roles;
  }

  async getById(id) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) return JSON.parse(cached);

    const role = await Role.findById(id).lean();
    if (!role) return null;

    await redis.set(KEY_DETAIL(id), JSON.stringify(role), "EX", 3600);
    return role;
  }

  async create(payload) {
    const validation = validateRolePayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const role = await Role.create(payload);
      await redis.del(KEY_LIST(payload.tenantID));
      return role;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama role sudah digunakan di tenant ini"] };
      }
      throw err;
    }
  }

  async createOwnerRole(tenantID) {
    const payload = {
      tenantID,
      namaRole: "Owner",
      deskripsi: "Role sistem untuk pemilik toko (Full Access).",
      permissions: [] // TODO: Isi dengan Semua Permission ID yang tersedia
    };

    // 2. Buat Role Langsung (Bypass validasi publik karena ini system action)
    const role = await Role.create(payload);

    // 3. Invalidate Cache
    await redis.del(KEY_LIST(tenantID));

    return role;
  }

  async update(id, payload) {
    const validation = validateRolePayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID; // Security

    try {
      const currentRole = await Role.findById(id);
      
      // Proteksi Nama Role Owner
      if (currentRole && currentRole.namaRole === "Owner" && payload.namaRole) {
         if (payload.namaRole !== "Owner") {
            return { error: ["Role Owner tidak dapat diubah namanya"] };
         }
      }

      const updated = await Role.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      }).lean();

      if (!updated) return null;

      await redis.del(KEY_LIST(updated.tenantID));
      await redis.del(KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nama role sudah digunakan"] };
      throw err;
    }
  }

  async delete(id) {
    const role = await Role.findById(id);
    if (!role) return null;

    if (role.namaRole === "Owner") {
        throw createError(403, "Role Owner tidak dapat dihapus (System Protected)");
    }

    await role.deleteOne();

    await redis.del(KEY_LIST(role.tenantID));
    await redis.del(KEY_DETAIL(id));

    return true;
  }
}

module.exports = new RoleService();