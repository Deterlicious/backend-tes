const Absensi = require("../models/absensiModel");
const mongoose = require("mongoose");
const redis = require("../utils/redisClient");
const createError = require("http-errors");
const { validateAbsensiPayload } = require("../validators/absensiValidator");

// --- CACHE KEYS (Mengikuti Standar AkunService Teman Anda) ---
const KEY_LIST = (tenantID) => `absensi:list:${tenantID}`;
const KEY_DETAIL = (id) => `absensi:detail:${id}`;

class AbsensiService {
  // --- CACHE HELPER ---
  // Membersihkan cache setelah mutasi (create/update/delete)
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- CREATE ---
  async create(payload) {
    // 1. Validasi (Sesuai standar throw error teman Anda)
    const validation = validateAbsensiPayload(payload, false);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]); // Ambil error pertama
    }

    const { waktuMasuk, waktuPulang, tenantID } = payload;

    // 2. Business Logic: Validasi Waktu
    if (new Date(waktuPulang) <= new Date(waktuMasuk)) {
      throw createError(400, "Waktu pulang harus setelah waktu masuk.");
    }

    // 3. Simpan ke DB
    const newAbsensi = await Absensi.create(payload);

    // 4. Invalidate Cache List Tenant
    await this.clearCache(null, tenantID);

    return newAbsensi;
  }

  // --- GET ALL (READ) ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID diperlukan.");

    // 1. Cek Cache Redis
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    // 2. Query DB dengan .lean() untuk performa tinggi
    const absensi = await Absensi.find({ tenantID })
      .populate("penggunaID", "username nama email")
      .sort({ tanggal: -1 })
      .lean();

    // 3. Set Cache (EX: 300 detik / 5 menit sesuai standar profil)
    if (absensi.length > 0) {
      await redis.set(KEY_LIST(tenantID), JSON.stringify(absensi), "EX", 300);
    }

    return absensi;
  }

  // --- GET BY ID ---
  async getById(id, tenantID) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, "ID Absensi tidak valid.");
    }

    // 1. Cek Cache Detail
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Keamanan: Pastikan data di cache tetap milik tenant yang benar
      if (data.tenantID.toString() !== tenantID.toString()) {
        throw createError(403, "Akses ditolak.");
      }
      return data;
    }

    // 2. Query DB dengan Filter Tenant ID (Keamanan Isolasi)
    const absensi = await Absensi.findOne({ _id: id, tenantID })
      .populate("penggunaID", "username nama")
      .lean();

    if (!absensi) throw createError(404, "Data absensi tidak ditemukan.");

    // 3. Set Cache Detail
    await redis.set(KEY_DETAIL(id), JSON.stringify(absensi), "EX", 600); // 10 Menit

    return absensi;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, "ID tidak valid.");
    }

    // 1. Validasi Input
    const validation = validateAbsensiPayload(payload, true);
    if (!validation.valid) {
      throw createError(400, validation.errors[0]);
    }

    const updates = validation.updates;

    // 2. Cek eksistensi dan kepemilikan data sebelum update
    const currentData = await Absensi.findOne({ _id: id, tenantID }).lean();
    if (!currentData) throw createError(404, "Data tidak ditemukan.");

    // 3. Update DB
    const updated = await Absensi.findOneAndUpdate(
      { _id: id, tenantID },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    // 4. Bersihkan Cache (Detail & List)
    await this.clearCache(id, tenantID);

    return updated;
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, "ID tidak valid.");
    }

    // Hanya hapus jika ID dan tenantID cocok
    const deleted = await Absensi.findOneAndDelete({ _id: id, tenantID });

    if (!deleted) {
      throw createError(404, "Data tidak ditemukan atau akses ditolak.");
    }

    // Bersihkan Cache
    await this.clearCache(id, tenantID);

    return true;
  }
}

module.exports = new AbsensiService();
