const Tenant = require("../models/tenantModel");
const Akun = require("../models/akunModel");
const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
const RolePermission = require("../models/rolePermissionModel");
const redis = require("../config/redis");
const { validateTenantPayload } = require("../validators/tenantValidator");
const createError = require("http-errors");

const CACHE_KEY_ALL = "tenants:all";
const CACHE_KEY_ID = (id) => `tenants:${id}`;

class TenantService {

  async getAll() {
    const cached = await redis.get(CACHE_KEY_ALL);
    if (cached) return JSON.parse(cached);

    const tenants = await Tenant.find().lean();
    await redis.set(CACHE_KEY_ALL, JSON.stringify(tenants), "EX", 60);
    return tenants;
  }

  async getById(id) {
    const key = CACHE_KEY_ID(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const tenant = await Tenant.findById(id).lean();
    if (!tenant) return null;

    await redis.set(key, JSON.stringify(tenant), "EX", 60);
    return tenant;
  }

  async createWithOwner(payload, userId) {
    const validation = validateTenantPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    const user = await Akun.findById(userId);
    if (!user) throw createError(404, "Akun tidak ditemukan.");
    if (user.tenantID) {
      throw createError(400, "Akun sudah memiliki tenant.");
    }

    try {
      const tenant = await Tenant.create(payload);

      const ownerRole = await Role.create({
        tenantID: tenant._id,
        namaRole: "Owner",
        deskripsi: "Role otomatis dengan akses penuh"
      });

      const permissions = await Permission.find().select("_id");
      if (permissions.length > 0) {
        const rolePerm = permissions.map(p => ({
          tenantID: tenant._id,
          roleID: ownerRole._id,
          permissionID: p._id
        }));
        await RolePermission.insertMany(rolePerm);
      }

      await redis.del(CACHE_KEY_ALL);

      return { tenant, ownerRole };

    } catch (err) {
      console.error("Create tenant failed:", err);
      throw err;
    }
  }

  async forceDelete(tenantID) {
    await RolePermission.deleteMany({ tenantID });
    await Role.deleteMany({ tenantID });
    await Tenant.findByIdAndDelete(tenantID);

    await redis.del(CACHE_KEY_ALL);
    await redis.del(CACHE_KEY_ID(tenantID));
  }

  async update(id, payload) {
    const validation = validateTenantPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    const updated = await Tenant.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    }).lean();

    if (!updated) return null;

    await redis.del(CACHE_KEY_ALL);
    await redis.del(CACHE_KEY_ID(id));
    return updated;
  }

  async delete(id) {
    const deleted = await Tenant.findByIdAndDelete(id).lean();
    if (!deleted) return null;

    await redis.del(CACHE_KEY_ALL);
    await redis.del(CACHE_KEY_ID(id));
    return deleted;
  }
}

module.exports = new TenantService();
