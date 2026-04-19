const Tenant = require("../models/tenantModel");
const Akun = require("../models/akunModel");
const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
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

  async createWithOwner(payload, akunID) {
    // 1. Validasi Payload Tenant
    const validation = validateTenantPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    // 2. Validasi Akun
    const akun = await Akun.findById(akunID);
    if (!akun) throw createError(404, "Akun tidak ditemukan.");
    if (akun.tenantID) {
      throw createError(400, "Akun sudah memiliki tenant.");
    }

    let tenant = null;
    let ownerRole = null;

    try {
      // 3. Persiapkan data Permission terlebih dahulu
      // Ambil semua ID permission yang ada di database
      const permissions = await Permission.find().select("_id").lean();
      const permissionIDs = permissions.map((p) => p._id);

      // 4. Buat Tenant
      tenant = await Tenant.create(payload);

      // 5. Buat Role Owner (Tetap berjalan seperti biasa)
      ownerRole = await Role.create({
        tenantID: tenant._id,
        namaRole: "Owner",
        deskripsi: "Role otomatis dengan akses penuh",
        permissions: permissionIDs,
      });

      // 6. Update Akun (🔥 HANYA Link ke Tenant, TANPA roleID)
      const updatedAkun = await Akun.findByIdAndUpdate(
        akunID,
        {
          tenantID: tenant._id,
          // roleID dihapus dari sini karena tabel Akun sudah tidak pakai roleID
        },
        { new: true, runValidators: true },
      );

      if (!updatedAkun) {
        throw createError(500, "Gagal mengupdate akun.");
      }

      // 7. Bersihkan cache
      await redis.del(CACHE_KEY_ALL);

      return {
        tenant,
        akun: updatedAkun,
        role: ownerRole,
      };
    } catch (err) {
      // ROLLBACK MANUAL
      // Jika error, hapus tenant dan role yang sempat terbuat
      if (tenant) {
        await Tenant.deleteOne({ _id: tenant._id });
      }

      if (ownerRole) {
        await Role.deleteOne({ _id: ownerRole._id });
        // Tidak perlu menghapus RolePermission lagi karena kita tidak membuatnya terpisah
      }

      throw err;
    }
  }

  async forceDelete(tenantID) {
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