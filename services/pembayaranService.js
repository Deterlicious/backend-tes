const Pembayaran = require("../models/pembayaranModel");
const Penjualan = require("../models/penjualanModel");
const AkunKas = require("../models/akunKasModel");
const redis = require("../config/redis");
const { validatePembayaranPayload } = require("../validators/pembayaranValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `pembayaran:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `pembayaran:detail:${id}`;

class PembayaranService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await Pembayaran.find({ tenantID })
      .populate("penjualanID", "nomorFaktur totalBayar")
      .populate("akunKasID", "namaAkun nomorAkun")
      .sort({ paymentTimestamp: -1, createdAt: -1 })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 60);
    }
    return data;
  }

  async getById(id, requesterTenantID) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.tenantID !== requesterTenantID.toString()) return null;
      return parsed;
    }

    const data = await Pembayaran.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("penjualanID", "nomorFaktur totalBayar")
      .populate("akunKasID", "namaAkun nomorAkun")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validatePembayaranPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const [penjualanValid, akunKasValid] = await Promise.all([
        Penjualan.findOne({ _id: payload.penjualanID, tenantID: payload.tenantID }),
        AkunKas.findOne({ _id: payload.akunKasID, tenantID: payload.tenantID })
      ]);

      if (!penjualanValid) return { error: ["ID Penjualan tidak ditemukan atau akses ditolak."] };
      if (!akunKasValid) return { error: ["ID Akun Kas tidak ditemukan atau akses ditolak."] };

      const pembayaran = await Pembayaran.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return pembayaran;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Pembayaran untuk ID Penjualan ini sudah ada."] };
      }
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validatePembayaranPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.penjualanID;
    delete payload.createdAt;

    try {
      if (payload.akunKasID) {
        const akunKasValid = await AkunKas.findOne({ _id: payload.akunKasID, tenantID: requesterTenantID });
        if (!akunKasValid) return { error: ["ID Akun Kas tidak ditemukan."] };
      }

      const updated = await Pembayaran.findOneAndUpdate(
        { _id: id, tenantID: requesterTenantID },
        payload,
        {
          new: true,
          runValidators: true,
          context: "query",
        }
      ).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(requesterTenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await Pembayaran.deleteOne({ _id: id, tenantID: requesterTenantID });
    if (result.deletedCount === 0) return null;

    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new PembayaranService();