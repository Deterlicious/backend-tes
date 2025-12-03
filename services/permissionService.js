const Permission = require("../models/permissionModel");
const redis = require("../config/redis");
const { validatePermissionPayload } = require("../validators/permissionValidator");

// CACHE KEYS (Global, tidak per tenant)
const KEY_ALL = "permissions:all";
const KEY_GROUPED = "permissions:grouped";

class PermissionService {
  
  // Helper Internal: Bersihkan cache saat ada perubahan
  async clearCache() {
    await redis.del(KEY_ALL);
    await redis.del(KEY_GROUPED);
  }

  async getAll() {
    // Cek Cache
    const cached = await redis.get(KEY_ALL);
    if (cached) return JSON.parse(cached);

    // DB Query
    const permissions = await Permission.find().sort({ grup: 1, nama: 1 }).lean();

    // Set Cache (Tahan lama: 1 jam, karena jarang berubah)
    await redis.set(KEY_ALL, JSON.stringify(permissions), "EX", 3600);

    return permissions;
  }

  async getGrouped() {
    // Cek Cache
    const cached = await redis.get(KEY_GROUPED);
    if (cached) return JSON.parse(cached);

    // Aggregation Pipeline
    const grouped = await Permission.aggregate([
      {
        $group: {
          _id: "$grup",
          permissions: {
            $push: {
              _id: "$_id",
              nama: "$nama",
              deskripsi: "$deskripsi"
            },
          },
        },
      },
      {
        $sort: { _id: 1 }, // Urutkan nama grup A-Z
      },
    ]);

    // Set Cache
    await redis.set(KEY_GROUPED, JSON.stringify(grouped), "EX", 3600);

    return grouped;
  }

  async create(payload) {
    const validation = validatePermissionPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const permission = await Permission.create(payload);
      await this.clearCache(); // Invalidate cache
      return permission;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nama permission sudah ada"] };
      }
      throw err;
    }
  }

  async delete(id) {
    const permission = await Permission.findByIdAndDelete(id);
    if (!permission) return null;

    await this.clearCache(); // Invalidate cache
    return true;
  }
}

module.exports = new PermissionService();