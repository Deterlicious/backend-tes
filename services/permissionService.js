const Permission = require("../models/permissionModel");
const redis = require("../config/redis");
const { validatePermissionPayload } = require("../validators/permissionValidator");
const createError = require("http-errors");

// CACHE KEYS (Global)
const KEY_ALL = "permissions:all";
const KEY_GROUPED = "permissions:grouped";

class PermissionService {

  // 🔥 CLEAR CACHE
  async clearCache() {
    await redis.del([KEY_ALL, KEY_GROUPED]);
  }

  // =========================
  // 1. GET ALL PERMISSION
  // =========================
  async getAll() {
    const cached = await redis.get(KEY_ALL);
    if (cached) return JSON.parse(cached);

    const permissions = await Permission.find()
      .sort({ grup: 1, nama: 1 })
      .lean();

    await redis.set(KEY_ALL, JSON.stringify(permissions), "EX", 3600);

    return permissions;
  }

  // =========================
  // 2. GET GROUPED (UNTUK UI)
  // =========================
  async getGrouped() {
    const cached = await redis.get(KEY_GROUPED);
    if (cached) return JSON.parse(cached);

    const grouped = await Permission.aggregate([
      {
        $group: {
          _id: "$grup",
          permissions: {
            $push: {
              _id: "$_id",
              nama: "$nama",
              deskripsi: "$deskripsi",
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    await redis.set(KEY_GROUPED, JSON.stringify(grouped), "EX", 3600);

    return grouped;
  }

  // =========================
  // 3. CREATE PERMISSION
  // =========================
  async create(payload) {
    // 🔥 SANITASI DATA
    payload.nama = payload.nama?.toLowerCase().trim();
    payload.grup = payload.grup?.toLowerCase().trim();

    const validation = validatePermissionPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    try {
      const permission = await Permission.create(payload);
      await this.clearCache();
      return permission;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(409, "Nama permission sudah digunakan (harus unik)");
      }
      throw err;
    }
  }

  // =========================
  // 4. UPDATE PERMISSION
  // =========================
  async update(id, payload) {
    // 🔥 SANITASI (opsional field)
    if (payload.nama) payload.nama = payload.nama.toLowerCase().trim();
    if (payload.grup) payload.grup = payload.grup.toLowerCase().trim();

    const validation = validatePermissionPayload(payload, true);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    try {
      const permission = await Permission.findByIdAndUpdate(
        id,
        payload,
        { new: true, runValidators: true }
      );

      if (!permission) throw createError(404, "Permission tidak ditemukan");

      await this.clearCache();
      return permission;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(409, "Nama permission sudah digunakan");
      }
      throw err;
    }
  }

  // =========================
  // 5. DELETE PERMISSION
  // =========================
  async delete(id) {
    const permission = await Permission.findById(id);
    if (!permission) throw createError(404, "Permission tidak ditemukan");

    // 🔥 OPTIONAL PROTECTION (disarankan)
    const protectedPermissions = [
      "read-akun",
      "update-akun",
      "kelola-pengguna",
      "kelola-role"
    ];

    if (protectedPermissions.includes(permission.nama)) {
      throw createError(403, "Permission sistem tidak dapat dihapus");
    }

    await permission.deleteOne();
    await this.clearCache();

    return true;
  }
}

module.exports = new PermissionService();