const Absensi = require("../models/absensiModel");
const mongoose = require("mongoose");
const redis = require("../utils/redisClient");
const createError = require("http-errors");
const { validateAbsensiPayload } = require("../validators/absensiValidator"); // Import Validator

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyAbsensiList = (tenantID) => `absensi:tenant:${tenantID}`;
const keyAbsensiDetail = (id) => `absensi:detail:${id}`;

class AbsensiService {
  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input
    const validation = validateAbsensiPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    // 2. Validasi Logika Waktu (Harus dilakukan di service karena butuh semua field)
    if (new Date(payload.waktuPulang) <= new Date(payload.waktuMasuk)) {
      throw createError(400, "Waktu pulang harus setelah waktu masuk.");
    }

    try {
      const newAbsensi = await Absensi.create(payload);
      await redis.del(keyAbsensiList(payload.tenantID)); // Cache Invalidation

      return newAbsensi;
    } catch (error) {
      throw createError(500, error.message);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const cacheKey = keyAbsensiList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) return JSON.parse(cachedData);

    const absensi = await Absensi.find({ tenantID })
      .populate("tenantID", "namaToko status")
      .populate("penggunaID", "nama role")
      .sort({ tanggal: -1 });

    await redis.setEx(cacheKey, 60, JSON.stringify(absensi));
    return absensi;
  }

  // --- READ BY ID ---
  async getById(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    const cacheKey = keyAbsensiDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) return JSON.parse(cachedData);

    const absensi = await Absensi.findById(id)
      .populate("tenantID")
      .populate("penggunaID");

    if (!absensi) throw createError(404, "Data absensi tidak ditemukan");

    await redis.setEx(cacheKey, 60, JSON.stringify(absensi));
    return absensi;
  }

  // --- UPDATE ---
  async update(id, payload) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    // 1. Validasi Input & Whitelisting
    const validation = validateAbsensiPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    const updates = validation.updates; // Data yang sudah dicleaning/whitelisted

    // 2. Hitung Ulang Durasi Kerja (Logika Bisnis Waktu)
    if (updates.waktuMasuk || updates.waktuPulang) {
      const currentData = await Absensi.findById(id);
      if (!currentData) throw createError(404, "Data absensi tidak ditemukan");

      const masuk = updates.waktuMasuk
        ? new Date(updates.waktuMasuk)
        : new Date(currentData.waktuMasuk);
      const pulang = updates.waktuPulang
        ? new Date(updates.waktuPulang)
        : new Date(currentData.waktuPulang);

      if (pulang <= masuk) {
        throw createError(400, "Waktu pulang harus setelah waktu masuk.");
      }

      const durasiMs = pulang - masuk;
      updates.durasiKerja = parseFloat(
        (durasiMs / (1000 * 60 * 60)).toFixed(2)
      );
    }

    // 3. Update DB
    const absensi = await Absensi.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!absensi) throw createError(404, "Data absensi tidak ditemukan");

    // 4. Cache Invalidation
    await redis.del(keyAbsensiDetail(id));
    await redis.del(keyAbsensiList(absensi.tenantID));

    return absensi;
  }

  // --- DELETE ---
  async delete(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    const absensi = await Absensi.findById(id);
    if (!absensi) throw createError(404, "Data absensi tidak ditemukan");

    await Absensi.findByIdAndDelete(id);

    // Cache Invalidation
    await redis.del(keyAbsensiDetail(id));
    await redis.del(keyAbsensiList(absensi.tenantID));

    return { message: "Data absensi berhasil dihapus" };
  }
}

module.exports = new AbsensiService();
