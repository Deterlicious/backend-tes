const KontrakKompensasi = require("../models/kontrakKompensasiModel");
const redis = require("../config/redis");
const { validateKontrakPayload } = require("../validators/kontrakKompensasiValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `kontrak:list:${tenantID}`;
const KEY_DETAIL = (id) => `kontrak:detail:${id}`;

class KontrakKompensasiService {
  async clearCache(tenantID, id) {
    await redis.del(KEY_LIST(tenantID));
    if (id) await redis.del(KEY_DETAIL(id));
  }

  async getAll(tenantID) {
    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);

    if (cached) return JSON.parse(cached);

    const data = await KontrakKompensasi.find({ tenantID })
      .populate("penggunaID", "nama email role")
      .sort({ createdAt: -1 })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 300);
    }

    return data;
  }

  async getById(id, requesterTenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.tenantID !== requesterTenantID.toString()) return null;
      return parsed;
    }

    const data = await KontrakKompensasi.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("penggunaID", "nama email")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateKontrakPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    const kontrak = await KontrakKompensasi.create(payload);
    await this.clearCache(payload.tenantID);

    return kontrak;
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateKontrakPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.penggunaID;

    const existing = await KontrakKompensasi.findOne({ _id: id, tenantID: requesterTenantID }).lean();
    if (!existing) return null;

    if (payload.tanggalMulai || payload.tanggalSelesai) {
      const start = payload.tanggalMulai ? new Date(payload.tanggalMulai) : new Date(existing.tanggalMulai);
      const end = payload.tanggalSelesai ? new Date(payload.tanggalSelesai) : (existing.tanggalSelesai ? new Date(existing.tanggalSelesai) : null);

      if (end && end < start) {
        return { error: ["tanggalSelesai tidak boleh sebelum tanggalMulai"] };
      }
    }

    const updated = await KontrakKompensasi.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();

    await this.clearCache(requesterTenantID, id);
    return updated;
  }

  async delete(id, requesterTenantID) {
    const result = await KontrakKompensasi.deleteOne({ _id: id, tenantID: requesterTenantID });
    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);
    return true;
  }
}

module.exports = new KontrakKompensasiService();