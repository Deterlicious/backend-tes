const Pengguna = require("../models/penggunaModel");
const Role = require("../models/roleModel");
const RolePermission = require("../models/rolePermissionModel");
const Permission = require("../models/permissionModel");
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");
const createError = require("http-errors");

// CACHE KEYS
const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
const KEY_LOGIN_SCREEN = (tenantID) => `pengguna:loginscreen:${tenantID}`;

class PenggunaService {
  
  // HELPERS: Cache Invalidation
  async clearCache(tenantID, userID) {
    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_LOGIN_SCREEN(tenantID));
    if (userID) await redis.del(KEY_DETAIL(userID));
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID required");

    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    const users = await Pengguna.find({ tenantID })
      .populate("roleID", "namaRole")
      .populate("posisiID", "namaPosisi")
      .select("-pin") // Security: Never send hash
      .lean();

    await redis.set(KEY_LIST(tenantID), JSON.stringify(users), "EX", 60);
    return users;
  }

  async getById(id) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) return JSON.parse(cached);

    const user = await Pengguna.findById(id)
      .populate("roleID", "namaRole")
      .populate("posisiID", "namaPosisi")
      .select("-pin")
      .lean();

    if (!user) return null;

    await redis.set(KEY_DETAIL(id), JSON.stringify(user), "EX", 60);
    return user;
  }

  async getForLoginScreen(tenantID) {
    const key = KEY_LOGIN_SCREEN(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // Hanya user AKTIF untuk layar login POS
    const users = await Pengguna.find({ tenantID, status: "aktif" })
      .select("nama fotoKaryawan roleID posisiID")
      .populate("roleID", "namaRole")
      .populate("posisiID", "namaPosisi")
      .lean();

    // Cache lebih lama (5 menit) karena jarang berubah
    await redis.set(key, JSON.stringify(users), "EX", 300);
    return users;
  }

  async create(payload, isSelfRegisterOwner = false) {
    const validation = validatePenggunaPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    // Cek PIN Duplikat di Tenant yang sama
    // manual check karena PIN di DB di-hash, tidak bisa query "pin: 123456"
    // izinkan duplikat PIN antar user. PIN '123456' milik Budi beda hash dengan PIN '123456' milik Andi.
    // Login nanti loop user di tenant -> compare satu2.

    // Logika Owner vs Karyawan
    const userCount = await Pengguna.countDocuments({ tenantID: payload.tenantID });
    
    // Jika tenant sudah punya user, tapi yang request bukan admin (public register), tolak
    if (userCount > 0 && isSelfRegisterOwner) {
      throw createError(403, "Tenant ini sudah memiliki Owner.");
    }

    let finalRoleID = payload.roleID;

    // Auto-Setup Owner (User Pertama)
    if (userCount === 0) {
      let ownerRole = await Role.findOne({ tenantID: payload.tenantID, namaRole: "Owner" });
      
      if (!ownerRole) {
        ownerRole = await Role.create({
          tenantID: payload.tenantID,
          namaRole: "Owner",
          deskripsi: "Super Admin (Auto Generated)",
        });
        
        // Assign All Permissions
        const allPerms = await Permission.find({});
        const permInserts = allPerms.map(p => ({
          tenantID: payload.tenantID,
          roleID: ownerRole._id,
          permissionID: p._id
        }));
        if(permInserts.length > 0) await RolePermission.insertMany(permInserts);
      }
      finalRoleID = ownerRole._id;
    }

    const newUser = await Pengguna.create({
      ...payload,
      roleID: finalRoleID,
      tokenVersion: 0
    });

    await this.clearCache(payload.tenantID);
    return newUser;
  }

  async update(id, payload) {
    const validation = validatePenggunaPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    // Security: Jangan update tenantID
    delete payload.tenantID;

    // Logic PIN Update handled by Mongoose pre-save hook
    // Tapi findByIdAndUpdate tidak trigger pre-save hook secara default jika pakai object langsung
    // harus ambil document, modify, lalu save.
    
    const user = await Pengguna.findById(id);
    if (!user) return null;

    Object.assign(user, payload); // Update fields
    const updated = await user.save(); // Trigger hashing PIN jika berubah

    await this.clearCache(user.tenantID, id);
    return updated;
  }

  async delete(id) {
    const user = await Pengguna.findById(id);
    if (!user) return null;

    await user.deleteOne();
    await this.clearCache(user.tenantID, id);
    return true;
  }
}

module.exports = new PenggunaService();