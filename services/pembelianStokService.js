const PembelianStok = require("../models/pembelianStokModel");
const redis = require("../config/redis");
const { validatePembelianPayload } = require("../validators/pembelianStokValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `pembelian:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `pembelian:detail:${id}`;

class PembelianStokService {
  _generateNomorFaktur() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");

    return `INV/${yyyy}${mm}${dd}/${hh}${min}${ss}${ms}`;
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await PembelianStok.find({ tenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("items.bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .sort({ tanggal: -1, createdAt: -1 })
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

    const data = await PembelianStok.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("akunKasID", "namaAkun nomorAkun")
      .populate("items.bahanBakuID", "namaBahan satuan")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validatePembelianPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      if (!payload.nomorFaktur) {
        payload.nomorFaktur = this._generateNomorFaktur();
      }

      const pembelian = await PembelianStok.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return pembelian;
    } catch (err) {
      if (err.code === 11000) {
        return { error: ["Nomor Faktur otomatis bentrok, silakan coba lagi."] };
      }
      throw err;
    }
  }

  async update(id, payload, requestedTenantID) {
    const validation = validatePembelianPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.createdAt;

    try {
      const updated = await PembelianStok.findOneAndUpdate(
        { _id: id, tenantID: requestedTenantID },
        payload,
        {
          new: true,
          runValidators: true,
          context: "query",
        }
      ).lean();

      if (!updated) return null;

      await redis.del(CACHE_KEY_LIST(requestedTenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      if (err.code === 11000) return { error: ["Nomor Faktur duplikat"] };
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await PembelianStok.deleteOne({ _id: id, tenantID: requesterTenantID });
    if (result.deletedCount === 0) return null;

    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new PembelianStokService();