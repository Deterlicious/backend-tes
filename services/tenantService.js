const Tenant = require("../models/tenantModel");
const Akun = require("../models/akunModel");
const redis = require("../config/redis");
const { validateTenantPayload } = require("../validators/tenantValidator");

// KEY constants
const CACHE_KEY_ALL = "tenants:all";
const CACHE_KEY_ID = (id) => `tenants:${id}`;

class TenantService {
  async getAll() {
    // cek cache dulu
    const cached = await redis.get(CACHE_KEY_ALL);
    if (cached) return JSON.parse(cached);

    // jika tidak ada di cache → ambil dari DB
    const tenants = await Tenant.find().lean();

    // simpan ke redis, TTL 60 detik
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

  async create(payload, userId) {
    // Validasi
    const validation = validateTenantPayload(payload);
    if (!validation.valid) {
      return { error: validation.errors };
    }

    // Buat Tenant Baru
    const tenant = await Tenant.create(payload);

    // Update Akun user yang sedang login, masukkan tenantID baru
    if (userId) {
      await Akun.findByIdAndUpdate(userId, {
        tenantID: tenant._id,
        role: "owner",
      });

      // Hapus cache profile user agar saat dia GET /auth/akun, datanya fresh
      await redis.del(`akun:profile:${userId}`);
    }

    await redis.del(CACHE_KEY_ALL); // Hapus cache list tenant

    return tenant;
  }

  async update(id, payload) {
    // VALIDASI FORM
    const validation = validateTenantPayload(payload, true);
    if (!validation.valid) {
      return { error: validation.errors };
    }

    const updated = await Tenant.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
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
