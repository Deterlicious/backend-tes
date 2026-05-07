const Diskon = require("../models/diskonModel");
const redis = require("../config/redis");
const { validateDiskonPayload } = require("../validators/diskonValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID, filterKey) =>
  `diskon:list:${tenantID}:${filterKey}`;
const KEY_DETAIL = (id) => `diskon:detail:${id}`;

class DiskonService {
  async clearCache(tenantID, id) {
    const pattern = `diskon:list:${tenantID}:*`;
    let cursor = "0";
    const keysToDelete = [];

    do {
      const res = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = res[0];
      const keys = res[1] || [];

      if (keys.length) {
        keysToDelete.push(...keys);
      }
    } while (cursor !== "0");

    if (id) {
      keysToDelete.push(KEY_DETAIL(id));
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  }

  _formatOutput(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) return doc.map((d) => this._formatOutput(d));

    return {
      _id: doc._id,
      tenantID: doc.tenantID,
      namaDiskon: doc.namaDiskon,
      cakupan: doc.cakupan,
      tipe: doc.tipe,
      nilai: doc.nilai,
      bisaDigabung: doc.bisaDigabung,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getAll(tenantID, query = {}) {
    if (!tenantID) {
      throw createError(400, "Tenant ID required");
    }

    const filter = { tenantID };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.cakupan) {
      filter.cakupan = query.cakupan;
    }

    if (query.tipe) {
      filter.tipe = query.tipe;
    }

    const filterKey = JSON.stringify(filter);
    const key = KEY_LIST(tenantID, filterKey);

    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await Diskon.find(filter)
      .sort({ status: -1, createdAt: -1 })
      .lean();

    const formatted = this._formatOutput(data);

    if (formatted.length > 0) {
      await redis.set(key, JSON.stringify(formatted), "EX", 300);
    }

    return formatted;
  }

  async getById(id, requesterTenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);

      if (parsed.tenantID !== requesterTenantID.toString()) {
        return null;
      }

      return parsed;
    }

    const data = await Diskon.findOne({
      _id: id,
      tenantID: requesterTenantID,
    }).lean();

    if (!data) {
      return null;
    }

    const formatted = this._formatOutput(data);
    await redis.set(key, JSON.stringify(formatted), "EX", 300);

    return formatted;
  }

  async create(payload) {
    const validation = validateDiskonPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    try {
      const diskon = await Diskon.create(payload);

      await this.clearCache(payload.tenantID);

      const created = await Diskon.findById(diskon._id).lean();

      return this._formatOutput(created);
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama diskon sudah digunakan di tenant ini");
      }

      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateDiskonPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;

    try {
      const updated = await Diskon.findOneAndUpdate(
        { _id: id, tenantID: requesterTenantID },
        payload,
        { new: true, runValidators: true },
      ).lean();

      if (!updated) {
        return null;
      }

      await this.clearCache(requesterTenantID, id);

      return this._formatOutput(updated);
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Nama diskon sudah digunakan di tenant ini");
      }

      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await Diskon.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) {
      return null;
    }

    await this.clearCache(requesterTenantID, id);

    return true;
  }

  async validateKombinasiDiskon(diskonIds, tenantID) {
    const ids = Array.isArray(diskonIds) ? diskonIds.filter(Boolean) : [];

    if (ids.length <= 1) {
      return { valid: true };
    }

    const diskons = await Diskon.find({
      _id: { $in: ids },
      tenantID,
      status: "Aktif",
    })
      .select("_id bisaDigabung status")
      .lean();

    if (diskons.length !== ids.length) {
      return {
        valid: false,
        errors: ["Ada diskon yang tidak valid / non-aktif / beda tenant"],
      };
    }

    const nonStackable = diskons.filter((d) => d.bisaDigabung === false);

    if (nonStackable.length > 0) {
      return {
        valid: false,
        errors: [
          "Terdapat diskon yang tidak bisa digabung, sehingga hanya boleh 1 diskon.",
        ],
      };
    }

    return { valid: true };
  }

  // --- FUNGSI BARU UNTUK DIGUNAKAN OLEH MODUL PENJUALAN / BOOKING ---
  async hitungDanValidasiPotongan(
    diskonId,
    hargaAwal,
    cakupanDiminta,
    tenantID,
  ) {
    // Memanggil getById agar sekaligus memanfaatkan Redis Cache
    const diskon = await this.getById(diskonId, tenantID);

    if (!diskon) {
      return {
        valid: false,
        error: "Diskon tidak valid atau tidak ditemukan.",
      };
    }

    if (diskon.status !== "Aktif") {
      return {
        valid: false,
        error: `Diskon '${diskon.namaDiskon}' saat ini sedang tidak aktif.`,
      };
    }

    if (diskon.cakupan !== cakupanDiminta) {
      return {
        valid: false,
        error: `Diskon '${diskon.namaDiskon}' adalah diskon ${diskon.cakupan}, tidak bisa digunakan sebagai diskon ${cakupanDiminta}.`,
      };
    }

    let potongan = 0;

    if (diskon.tipe === "persen") {
      potongan = hargaAwal * (diskon.nilai / 100);
    } else if (diskon.tipe === "nominal") {
      potongan = diskon.nilai;
    }

    // Validasi krusial: Potongan tidak boleh lebih besar dari harga awal (mencegah minus)
    if (potongan > hargaAwal) {
      return {
        valid: false,
        error: `Nilai diskon (Rp ${potongan.toLocaleString("id-ID")}) melebihi total harga (Rp ${hargaAwal.toLocaleString("id-ID")}).`,
      };
    }

    return {
      valid: true,
      potongan: potongan,
      hargaAkhir: hargaAwal - potongan,
      dataDiskon: diskon,
    };
  }
}

module.exports = new DiskonService();
