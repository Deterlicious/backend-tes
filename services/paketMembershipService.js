const PaketMembership = require("../models/paketMembershipModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validatePaketMembershipPayload,
} = require("../validators/paketMembershipValidator"); // Import Validator
// const redis = require("../utils/redisClient"); // Asumsi Redis

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const keyPaketList = (tenantID) => `paket:tenant:${tenantID}`;

class PaketMembershipService {
  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input
    const validation = validatePaketMembershipPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const paketMembership = await PaketMembership.create(payload);
      // await redis.del(keyPaketList(payload.tenantID)); // Cache Invalidation
      return paketMembership;
    } catch (error) {
      if (error.code === 11000) {
        throw createError(400, {
          message:
            "Gagal menambahkan. Nama paket sudah terdaftar dalam tenant ini.",
        });
      }
      throw createError(500, error.message);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    // Asumsi caching logic di sini

    const paketMembership = await PaketMembership.find({ tenantID }).sort({
      harga: 1,
    });

    if (paketMembership.length === 0)
      throw createError(
        404,
        "Tidak ada data Paket Membership untuk tenant ini."
      );

    return paketMembership;
  }

  // --- READ BY ID ---
  async getById(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    // Asumsi caching logic di sini

    const paketMembership = await PaketMembership.findById(id);

    if (!paketMembership)
      throw createError(404, "Paket Membership tidak ditemukan.");
    return paketMembership;
  }

  // --- UPDATE ---
  async update(id, payload) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    // 1. Validasi Input & Whitelisting/Field Asing Check
    const validation = validatePaketMembershipPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    const updates = validation.updates;

    try {
      const paketMembership = await PaketMembership.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
          runValidators: true,
          context: "query", // Penting untuk unique index update
        }
      );

      if (!paketMembership)
        throw createError(404, "Paket Membership tidak ditemukan");

      // await redis.del(keyPaketList(paketMembership.tenantID)); // Cache Invalidation
      return paketMembership;
    } catch (error) {
      if (error.code === 11000) {
        throw createError(400, {
          message:
            "Gagal menambahkan/memperbarui. Nama paket sudah terdaftar dalam tenant ini.",
        });
      }
      throw createError(400, error.message);
    }
  }

  // --- DELETE ---
  async delete(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    const paketMembership = await PaketMembership.findByIdAndDelete(id);

    if (!paketMembership)
      throw createError(404, "Paket Membership tidak ditemukan");

    // await redis.del(keyPaketList(paketMembership.tenantID)); // Cache Invalidation
    return { message: "Paket Membership berhasil dihapus" };
  }
}

module.exports = new PaketMembershipService();
