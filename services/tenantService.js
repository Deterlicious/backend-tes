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
    // Validasi Input
    const validation = validateTenantPayload(payload);
    if (!validation.valid) {
      return { error: validation.errors };
    }

    // Cek Validitas User
    const user = await Akun.findById(userId);
    if (!user) throw createError(404, "Akun pengguna tidak ditemukan");
    
    // Cek apakah user sudah punya tenant (1 Akun = 1 Tenant)
    if (user.tenantID) {
      throw createError(400, "Akun Anda sudah memiliki toko. Tidak dapat membuat baru.");
    }

    try {

      // Buat Tenant Baru
      const tenant = await Tenant.create(payload);

      // Buat Role 'Owner' Otomatis
      const ownerRole = await Role.create({
        tenantID: tenant._id,
        namaRole: "Owner",
        deskripsi: "Role otomatis dengan akses penuh (Super Admin)"
      });

      // Ambil Semua Permission dari Master Data
      // (Pastikan sudah menjalankan seeder permission sebelumnya)
      const allPermissions = await Permission.find({}).select("_id");

      if (allPermissions.length > 0) {
        // Assign Semua Permission ke Role Owner
        const rolePermData = allPermissions.map(perm => ({
          tenantID: tenant._id,
          roleID: ownerRole._id,
          permissionID: perm._id
        }));

        await RolePermission.insertMany(rolePermData);
      } else {
        console.warn("⚠️ Warning: Tabel Permission kosong. Role Owner dibuat tanpa hak akses.");
      }

      // E. Update Akun User
      // Note: Di akunModel.js Anda, enum role adalah ["client", "admin"].
      // Jadi saya set ke "admin". Jika ingin "owner", tambahkan ke enum di model Akun dulu.
      user.tenantID = tenant._id;
      
      // Simpan perubahan user
      await user.save();

      // --- END LOGIKA OTOMATISASI ---

      // Clean Up Cache
      await redis.del(CACHE_KEY_ALL); // Hapus list tenant global
      await redis.del(`akun:profile:${userId}`); // Hapus cache profil user agar data tenantID & role terupdate di FE

      return tenant;

    } catch (err) {
      // Error Handling: Jika terjadi error di tengah proses, idealnya kita rollback.
      // Karena MongoDB standalone (bukan replica set) tidak support transaction penuh,
      // kita biarkan error throw ke controller.
      console.error("Gagal membuat tenant & role:", err);
      throw err;
    }
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
    // Note: Menghapus tenant idealnya juga menghapus Role & RolePermission terkait (Cascade Delete)
    // Tapi untuk saat ini kita fokus hapus tenant-nya saja dulu.
    const deleted = await Tenant.findByIdAndDelete(id).lean();
    if (!deleted) return null;

    await redis.del(CACHE_KEY_ALL);
    await redis.del(CACHE_KEY_ID(id));

    return deleted;
  }
}

module.exports = new TenantService();