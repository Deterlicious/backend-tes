const Aset = require("../models/asetModel");
const SesiBooking = require("../models/sesiBookingModel"); // <-- Modul ini dipanggil untuk mengecek jadwal aset
const redis = require("../config/redis");
const { validateAsetPayload } = require("../validators/asetValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID, filterKey) => `aset:list:${tenantID}:${filterKey}`;
const KEY_DETAIL = (id) => `aset:detail:${id}`;

class AsetService {
  async clearCache(tenantID, id) {
    const pattern = `aset:list:${tenantID}:*`;
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

  _formatOutput(doc, inUseSet = new Set()) {
    if (!doc) return null;
    if (Array.isArray(doc))
      return doc.map((d) => this._formatOutput(d, inUseSet));

    let currentStatus = doc.status;

    // LOGIKA STATUS DINAMIS
    // Jika tidak sedang diperbaiki toko, kita cek apakah saat ini aset sedang disewa.
    if (currentStatus !== "perbaikan") {
      if (inUseSet.has(doc._id.toString())) {
        currentStatus = "digunakan";
      } else {
        currentStatus = "tersedia";
      }
    }

    return {
      _id: doc._id,
      tenantID: doc.tenantID,
      namaAset: doc.namaAset,
      dataAset: doc.tipeAsetID
        ? {
            _id: doc.tipeAsetID._id,
            namaTipeAset: doc.tipeAsetID.namaTipeAset,
            deskripsi: doc.tipeAsetID.deskripsi,
          }
        : null,
      status: currentStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getAll(tenantID, query = {}) {
    if (!tenantID) {
      throw createError(400, "Tenant ID required");
    }

    const filter = { tenantID };

    // Kita JANGAN memfilter query.status ke database, karena status sebenarnya ada di waktu nyata
    if (query.tipeAsetID) {
      filter.tipeAsetID = query.tipeAsetID;
    }

    const filterKey = JSON.stringify(query); // Pakai seluruh query sebagai kunci cache
    const key = KEY_LIST(tenantID, filterKey);

    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await Aset.find(filter)
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .sort({ createdAt: -1 })
      .lean();

    // 1. Ambil waktu detik ini
    const now = new Date();

    // 2. Cari semua SesiBooking dari tenant ini yang sedang Aktif detik ini
    const activeBookings = await SesiBooking.find({
      tenantID,
      status: "Aktif",
      waktuMulai: { $lte: now },
      $or: [{ waktuSelesai: null }, { waktuSelesai: { $gte: now } }],
    })
      .select("dataAset")
      .lean();

    // 3. Masukkan ID aset yang sedang digunakan ke dalam 'Set' agar pencariannya cepat
    const inUseSet = new Set(activeBookings.map((b) => b.dataAset.toString()));

    let formatted = this._formatOutput(data, inUseSet);

    // 4. Jika pengguna mencari berdasarkan status, kita filter array hasil akhirnya
    if (query.status) {
      formatted = formatted.filter((item) => item.status === query.status);
    }

    if (formatted.length > 0) {
      // Waktu cache diturunkan jadi 60 detik agar perubahan status lebih real-time
      await redis.set(key, JSON.stringify(formatted), "EX", 60);
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

    const data = await Aset.findOne({
      _id: id,
      tenantID: requesterTenantID,
    })
      .populate("tipeAsetID", "namaTipeAset deskripsi")
      .lean();

    if (!data) {
      return null;
    }

    // Cek apakah aset INI sedang dipakai detik ini
    const now = new Date();
    const activeBooking = await SesiBooking.findOne({
      tenantID: requesterTenantID,
      dataAset: id,
      status: "Aktif",
      waktuMulai: { $lte: now },
      $or: [{ waktuSelesai: null }, { waktuSelesai: { $gte: now } }],
    })
      .select("_id")
      .lean();

    const inUseSet = new Set();
    if (activeBooking) {
      inUseSet.add(data._id.toString());
    }

    const formatted = this._formatOutput(data, inUseSet);

    // Waktu cache diturunkan jadi 60 detik
    await redis.set(key, JSON.stringify(formatted), "EX", 60);

    return formatted;
  }

  async create(payload) {
    const validation = validateAsetPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    // Cegah kasir/admin nakal membuat aset yang langsung statusnya 'digunakan'
    if (!payload.status || payload.status === "digunakan") {
      payload.status = "tersedia";
    }

    const aset = await Aset.create(payload);

    await this.clearCache(payload.tenantID);

    // Melempar kembali ke getById agar logikanya konsisten dan ter-cache otomatis
    return await this.getById(aset._id, payload.tenantID);
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateAsetPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;

    // Jika admin salah setting dan menembak 'digunakan', kembalikan ke 'tersedia'
    // karena status 'digunakan' murni dari jadwal SesiBooking.
    if (payload.status === "digunakan") {
      payload.status = "tersedia";
    }

    const updated = await Aset.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      payload,
      { new: true, runValidators: true },
    );

    if (!updated) {
      return null;
    }

    await this.clearCache(requesterTenantID, id);

    // Langsung ambil dengan logika pencarian waktu nyata yang terjamin akurat
    return await this.getById(id, requesterTenantID);
  }

  async delete(id, requesterTenantID) {
    const result = await Aset.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) {
      return null;
    }

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new AsetService();
