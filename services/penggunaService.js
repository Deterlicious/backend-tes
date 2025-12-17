const Pengguna = require("../models/penggunaModel");
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");
const createError = require("http-errors");

// CACHE KEYS (Sama seperti sebelumnya)
const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;
const KEY_LOGIN_SCREEN = (tenantID) => `pengguna:loginscreen:${tenantID}`;

class PenggunaService {
  
  async clearCache(tenantID, userID) {
    await redis.del(KEY_LIST(tenantID));
    await redis.del(KEY_LOGIN_SCREEN(tenantID));
    if (userID) await redis.del(KEY_DETAIL(userID));
  }
  
  // Method ini harus diproteksi agar Owner B tidak bisa "mengintip" detail staff Toko A
  async getById(id, requesterTenantID) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
        const parsed = JSON.parse(cached);
        // Validasi Cache: Pastikan cache milik tenant yang sama
        if (parsed.tenantID !== requesterTenantID.toString()) return null;
        return parsed;
    }

    // Cari berdasarkan ID DAN TenantID
    const user = await Pengguna.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("roleID", "namaRole")
      .populate("posisiID", "namaPosisi")
      .select("-pin")
      .lean();

    if (!user) return null; // Jika ID ada tapi beda Tenant, return null

    await redis.set(KEY_DETAIL(id), JSON.stringify(user), "EX", 60);
    return user;
  }

  async create(payload) {
     return await Pengguna.create(payload); // Simplifikasi
  }

  async update(id, payload, requesterTenantID) {
    const validation = validatePenggunaPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    // Security: Hapus tenantID dari payload agar tidak bisa dipindah paksa
    delete payload.tenantID;

    // Gunakan findOne dengan 2 syarat
    const user = await Pengguna.findOne({ _id: id, tenantID: requesterTenantID });
    
    // Jika user tidak ditemukan (atau user ada tapi milik tenant lain)
    if (!user) return null; 

    // Update fields
    Object.assign(user, payload); 
    
    // Save (Trigger pre-save hook PIN hash)
    const updated = await user.save(); 

    await this.clearCache(requesterTenantID, id);
    return updated;
  }

  async delete(id, requesterTenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID: requesterTenantID });
    
    if (!user) return null; // Tidak ketemu atau beda tenant

    await user.deleteOne();
    await this.clearCache(requesterTenantID, id);
    return true;
  }
}

module.exports = new PenggunaService();