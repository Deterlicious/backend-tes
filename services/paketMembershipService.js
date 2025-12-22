const PaketMembership = require("../models/paketMembershipModel");
const mongoose = require("mongoose");
const redis = require("../config/redis"); // Path disesuaikan dengan AkunService
const createError = require("http-errors");
const {
  validatePaketMembershipPayload,
} = require("../validators/paketMembershipValidator");

// --- CACHE KEYS (Standar AkunService) ---
const KEY_LIST = (tenantID) => `paket:list:${tenantID}`;
const KEY_DETAIL = (id) => `paket:detail:${id}`;

class PaketMembershipService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input (Ambil pesan error pertama sesuai standar Akun)
    const validation = validatePaketMembershipPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    try {
      const paketMembership = await PaketMembership.create(payload);

      // 2. Invalidate Cache List Tenant
      await this.clearCache(null, payload.tenantID);

      return paketMembership;
    } catch (error) {
      if (error.code === 11000) {
        throw createError(400, "Nama paket sudah terdaftar dalam tenant ini.");
      }
      throw createError(500, error.message);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID wajib disertakan.");

    // 1. Cek Cache
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    // 2. Query DB dengan .lean() dan Sorting Harga
    const paketMembership = await PaketMembership.find({ tenantID })
      .sort({ harga: 1 })
      .lean();

    if (paketMembership.length === 0) {
      throw createError(
        404,
        "Tidak ada data Paket Membership untuk tenant ini."
      );
    }

    // 3. Set Cache (EX: 300 detik/5 menit)
    await redis.set(
      KEY_LIST(tenantID),
      JSON.stringify(paketMembership),
      "EX",
      300
    );

    return paketMembership;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    // 1. Cek Cache Detail
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Security Check: Anti-ID-Tampering
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    // 2. Query DB dengan isolasi Tenant
    const paketMembership = await PaketMembership.findOne({
      _id: id,
      tenantID,
    }).lean();

    if (!paketMembership)
      throw createError(404, "Paket Membership tidak ditemukan.");

    // 3. Set Cache Detail (EX: 600 detik/10 menit)
    await redis.set(KEY_DETAIL(id), JSON.stringify(paketMembership), "EX", 600);

    return paketMembership;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    // 1. Validasi Input
    const validation = validatePaketMembershipPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const updates = validation.updates;

    try {
      // 2. Update dengan filter tenantID (Hanya bisa update milik sendiri)
      const updated = await PaketMembership.findOneAndUpdate(
        { _id: id, tenantID },
        updates,
        { new: true, runValidators: true, context: "query" }
      ).lean();

      if (!updated) throw createError(404, "Paket Membership tidak ditemukan.");

      // 3. Clear Cache Detail & List
      await this.clearCache(id, tenantID);

      return updated;
    } catch (error) {
      if (error.code === 11000) {
        throw createError(400, "Nama paket sudah digunakan dalam tenant ini.");
      }
      throw createError(400, error.message);
    }
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    // 1. Delete dengan filter tenantID
    const deleted = await PaketMembership.findOneAndDelete({
      _id: id,
      tenantID,
    });

    if (!deleted)
      throw createError(
        404,
        "Paket Membership tidak ditemukan atau akses ditolak."
      );

    // 2. Clear Cache Detail & List
    await this.clearCache(id, tenantID);

    return { message: "Paket Membership berhasil dihapus" };
  }
}

module.exports = new PaketMembershipService();
