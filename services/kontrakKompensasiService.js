const KontrakKompensasi = require("../models/kontrakKompensasiModel");
const redis = require("../config/redis");
const { validateKontrakPayload } = require("../validators/kontrakKompensasiValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `kontrak:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `kontrak:detail:${id}`;

class KontrakKompensasiService {
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await KontrakKompensasi.find({ tenantID })
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email role")
      .sort({ createdAt: -1 })
      .lean();

    if (data.length > 0) {
      await redis.set(key, JSON.stringify(data), "EX", 60);
    }
    return data;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await KontrakKompensasi.findById(id)
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 60);
    return data;
  }

  async create(payload) {
    const validation = validateKontrakPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    const kontrak = await KontrakKompensasi.create(payload);

    await redis.del(CACHE_KEY_LIST(payload.tenantID));

    return kontrak;
  }

  async update(id, payload) {
    const validation = validateKontrakPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    const allowedUpdates = [
      "tipeGaji",
      "tarifGaji",
      "tanggalMulai",
      "tanggalSelesai",
      "status",
    ];
    const updates = {};
    Object.keys(payload).forEach((key) => {
      if (allowedUpdates.includes(key)) updates[key] = payload[key];
    });

    if (Object.keys(updates).length === 0) {
      return { error: ["Tidak ada data valid untuk diupdate"] };
    }

    if (updates.tanggalSelesai || updates.tanggalMulai) {
      const existing = await KontrakKompensasi.findById(id).lean();
      if (!existing) return null;

      const start = updates.tanggalMulai
        ? new Date(updates.tanggalMulai)
        : new Date(existing.tanggalMulai);
      const end = updates.tanggalSelesai
        ? new Date(updates.tanggalSelesai)
        : existing.tanggalSelesai
        ? new Date(existing.tanggalSelesai)
        : null;

      if (end && end < start) {
        return { error: ["tanggalSelesai tidak boleh sebelum tanggalMulai"] };
      }
    }

    const updated = await KontrakKompensasi.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return null;

    await redis.del(CACHE_KEY_LIST(updated.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return updated;
  }

  async delete(id) {
    const target = await KontrakKompensasi.findById(id).lean();
    if (!target) return null;

    await KontrakKompensasi.deleteOne({ _id: id });

    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new KontrakKompensasiService();