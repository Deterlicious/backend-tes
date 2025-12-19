const Pengguna = require("../models/penggunaModel");
const jwt = require("jsonwebtoken"); // Tambahan untuk login staff
const redis = require("../config/redis");
const { validatePenggunaPayload } = require("../validators/penggunaValidator");
const createError = require("http-errors");

const PENGGUNA_JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

const KEY_LIST = (tenantID) => `pengguna:list:${tenantID}`;
const KEY_DETAIL = (id) => `pengguna:detail:${id}`;

class PenggunaService {
  
  // Method Helper untuk Token Staff (Sederhana, Single Session)
  generateToken(pengguna) {
    return jwt.sign(
      { 
        id: pengguna._id, 
        role: pengguna.roleID, 
        version: pengguna.tokenVersion // Version control sederhana
      }, 
      PENGGUNA_JWT_SECRET, 
      { expiresIn: "12h" } // Shift kerja biasanya < 12 jam
    );
  }

  async clearCache(tenantID, userID) {
    await redis.del(KEY_LIST(tenantID));
    if (userID) await redis.del(KEY_DETAIL(userID));
  }

  // --- FITUR LOGIN (Yang sebelumnya hilang) ---
  async login(payload) {
    const { email, pin } = payload; // Login staff biasanya Email/Username + PIN

    const pengguna = await Pengguna.findOne({ email }).populate("roleID");
    if (!pengguna) throw createError(404, "Staf tidak ditemukan");

    // Asumsi di model Pengguna ada method comparePin
    const isMatch = await pengguna.comparePin(pin); 
    if (!isMatch) throw createError(400, "PIN salah");

    // Update Token Version (Logout di device lain)
    pengguna.tokenVersion = Math.floor(1000 + Math.random() * 9000);
    await pengguna.save();

    const token = this.generateToken(pengguna);

    return {
        user: {
            id: pengguna._id,
            nama: pengguna.nama,
            role: pengguna.roleID.namaRole,
            tenantID: pengguna.tenantID
        },
        token
    };
  }
  
  async getById(id, requesterTenantID) {
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.tenantID !== requesterTenantID.toString()) return null;
        return parsed;
    }

    const user = await Pengguna.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("roleID", "namaRole")
      .populate("posisiID", "namaPosisi")
      .select("-pin")
      .lean();

    if (!user) throw createError(404, "Staf tidak ditemukan"); // REVISI: Throw error

    await redis.set(KEY_DETAIL(id), JSON.stringify(user), "EX", 60);
    return user;
  }

  async create(payload) {
     const validation = validatePenggunaPayload(payload);
     if (!validation.valid) throw createError(400, validation.errors[0]);

     const newUser = await Pengguna.create(payload);
     await this.clearCache(payload.tenantID);
     return newUser;
  }

  async update(id, payload, requesterTenantID) {
    const validation = validatePenggunaPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    delete payload.tenantID; // Security

    const user = await Pengguna.findOne({ _id: id, tenantID: requesterTenantID });
    
    // REVISI: Throw error 404 jika tidak ketemu
    if (!user) throw createError(404, "Staf tidak ditemukan atau akses ditolak");

    Object.assign(user, payload); 
    const updated = await user.save(); 

    await this.clearCache(requesterTenantID, id);
    return updated;
  }

  async delete(id, requesterTenantID) {
    const user = await Pengguna.findOne({ _id: id, tenantID: requesterTenantID });
    
    if (!user) throw createError(404, "Staf tidak ditemukan");

    await user.deleteOne();
    await this.clearCache(requesterTenantID, id);
    return true;
  }
}

module.exports = new PenggunaService();