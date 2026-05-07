const MetodePembayaran = require("../models/metodePembayaranModel");
const AkunKas = require("../models/akunKasModel");
const redis = require("../config/redis");
const {
  validateMetodePembayaranPayload,
} = require("../validators/metodePembayaranValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `metodePembayaran:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `metodePembayaran:detail:${id}`;

class MetodePembayaranService {
  _formatOutput(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) return doc.map((d) => this._formatOutput(d));

    const dataAkunKas =
      doc.akunKasID && typeof doc.akunKasID === "object"
        ? {
            _id: doc.akunKasID._id,
            namaAkun: doc.akunKasID.namaAkun,
            nomorAkun: doc.akunKasID.nomorAkun,
          }
        : null;

    return {
      tenantID: doc.tenantID,
      dataAkunKas,
      namaPembayaran: doc.namaPembayaran,
      kategori: doc.kategori,
      isAutomated: doc.isAutomated,
      xenditChannelCode: doc.xenditChannelCode ?? null,
      isActive: doc.isActive,
      _id: doc._id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getAll(tenantID) {
    if (!tenantID) {
      throw createError(400, "tenantID is required");
    }

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const data = await MetodePembayaran.find({ tenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .sort({ isActive: -1, createdAt: -1 })
      .lean();

    const formatted = this._formatOutput(data);

    if (formatted.length > 0) {
      await redis.set(key, JSON.stringify(formatted), "EX", 300);
    }

    return formatted;
  }

  async getById(id, requesterTenantID) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (parsed.tenantID !== requesterTenantID.toString()) {
        return null;
      }

      return parsed;
    }

    const data = await MetodePembayaran.findOne({
      _id: id,
      tenantID: requesterTenantID,
    })
      .populate("akunKasID", "namaAkun nomorAkun")
      .lean();

    if (!data) {
      return null;
    }

    const formatted = this._formatOutput(data);

    await redis.set(key, JSON.stringify(formatted), "EX", 300);

    return formatted;
  }

  async create(payload) {
    const validation = validateMetodePembayaranPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    const akunKasValid = await AkunKas.findOne({
      _id: payload.akunKasID,
      tenantID: payload.tenantID,
    });

    if (!akunKasValid) {
      return { error: ["ID Akun Kas tidak ditemukan atau akses ditolak."] };
    }

    if (!payload.isAutomated) {
      payload.xenditChannelCode = null;
    }

    const created = await MetodePembayaran.create(payload);

    await redis.del(CACHE_KEY_LIST(payload.tenantID));

    const result = await MetodePembayaran.findOne({
      _id: created._id,
      tenantID: payload.tenantID,
    })
      .populate("akunKasID", "namaAkun nomorAkun")
      .lean();

    const formatted = this._formatOutput(result);

    await redis.set(
      CACHE_KEY_DETAIL(created._id.toString()),
      JSON.stringify(formatted),
      "EX",
      300,
    );

    return formatted;
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateMetodePembayaranPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;

    if (payload.akunKasID) {
      const akunKasValid = await AkunKas.findOne({
        _id: payload.akunKasID,
        tenantID: requesterTenantID,
      });

      if (!akunKasValid) {
        return { error: ["ID Akun Kas tidak ditemukan."] };
      }
    }

    if (payload.isAutomated === false) {
      payload.xenditChannelCode = null;
    }

    const updated = await MetodePembayaran.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      payload,
      { new: true, runValidators: true },
    )
      .populate("akunKasID", "namaAkun nomorAkun")
      .lean();

    if (!updated) {
      return null;
    }

    const formatted = this._formatOutput(updated);

    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    await redis.set(CACHE_KEY_DETAIL(id), JSON.stringify(formatted), "EX", 300);

    return formatted;
  }

  async delete(id, requesterTenantID) {
    const result = await MetodePembayaran.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) {
      return null;
    }

    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new MetodePembayaranService();
