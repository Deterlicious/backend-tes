const IzinCuti = require("../models/izinCutiModel");
const redis = require("../config/redis");
const { validateIzinCutiPayload } = require("../validators/izinCutiValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `izincuti:list:${tenantID}`;
const KEY_DETAIL = (id) => `izincuti:detail:${id}`;
const KEY_LIST_STAF = (tenantID, penggunaID) =>
  `izincuti:list:${tenantID}:${penggunaID}`;

class IzinCutiService {
  // --- 1. FORMATTER OUTPUT DATA (Urutan Properti Berdasarkan Permintaan) ---
  _formatData(doc) {
    if (!doc) return null;

    return {
      _id: doc._id,
      tenantID: doc.tenantID,
      penggunaID: doc.penggunaID, // Membawa object terpopulasi (nama, email)
      tanggalMulai: doc.tanggalMulai,
      tanggalSelesai: doc.tanggalSelesai,
      tipe: doc.tipe,
      status: doc.status,
      keterangan: doc.keterangan,
      dicatatOleh: doc.dicatatOleh, // Membawa object terpopulasi (nama) jika sudah di-approve/reject
      catatan: doc.catatan, // URUTAN: Berada tepat di bawah dicatatOleh
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // --- 2. MANAJEMEN PEMBERSIHAN CACHE (Mendukung Multi-Key) ---
  async clearCache(tenantID, id, penggunaID) {
    const keys = [KEY_LIST(tenantID)];
    if (id) keys.push(KEY_DETAIL(id));
    if (penggunaID) keys.push(KEY_LIST_STAF(tenantID, penggunaID));

    await redis.del(keys);
  }

  // --- 3. JALUR AKSES ADMIN (Melihat Semua Data Tenant) ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID required");

    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await IzinCuti.find({ tenantID })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = data.map((item) => this._formatData(item));

    if (formattedData.length > 0) {
      await redis.set(key, JSON.stringify(formattedData), "EX", 300);
    }

    return formattedData;
  }

  // --- 4. JALUR AKSES MANDIRI STAF (Melihat Data Milik Sendiri) ---
  async getAllByStaf(tenantID, penggunaID) {
    if (!tenantID || !penggunaID)
      throw createError(400, "Tenant ID and Pengguna ID required");

    const key = KEY_LIST_STAF(tenantID, penggunaID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await IzinCuti.find({ tenantID, penggunaID })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = data.map((item) => this._formatData(item));

    if (formattedData.length > 0) {
      await redis.set(key, JSON.stringify(formattedData), "EX", 300);
    }

    return formattedData;
  }

  // --- 5. AMBIL DETAIL DATA BERDASARKAN ID ---
  async getById(id, requesterTenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.tenantID !== requesterTenantID.toString()) return null;
      return parsed;
    }

    const data = await IzinCuti.findOne({
      _id: id,
      tenantID: requesterTenantID,
    })
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .lean();

    if (!data) return null;

    const formattedData = this._formatData(data);
    await redis.set(key, JSON.stringify(formattedData), "EX", 300);
    return formattedData;
  }

  // --- 6. PROSES BUAT DATA (POST) ---
  async create(payload) {
    const validation = validateIzinCutiPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    if (new Date(payload.tanggalSelesai) < new Date(payload.tanggalMulai)) {
      return { error: ["Tanggal selesai tidak boleh sebelum tanggal mulai"] };
    }

    try {
      let newIzinCuti = await IzinCuti.create(payload);
      newIzinCuti = await newIzinCuti.populate([
        { path: "penggunaID", select: "nama email" },
        { path: "dicatatOleh", select: "nama" },
      ]);

      // Bersihkan cache global tenant dan cache spesifik milik staf yang bersangkutan
      await this.clearCache(payload.tenantID, null, payload.penggunaID);
      return this._formatData(
        newIzinCuti.toObject ? newIzinCuti.toObject() : newIzinCuti,
      );
    } catch (err) {
      throw err;
    }
  }

  // --- 7. PROSES UPDATE DATA (PUT) ---
  async update(id, payload, requesterTenantID) {
    const validation = validateIzinCutiPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.penggunaID;

    try {
      const oldIzin = await IzinCuti.findOne({
        _id: id,
        tenantID: requesterTenantID,
      });
      if (!oldIzin) return null;

      const start = payload.tanggalMulai
        ? new Date(payload.tanggalMulai)
        : oldIzin.tanggalMulai;
      const end = payload.tanggalSelesai
        ? new Date(payload.tanggalSelesai)
        : oldIzin.tanggalSelesai;

      if (end < start) {
        return { error: ["Tanggal selesai tidak boleh sebelum tanggal mulai"] };
      }

      const updated = await IzinCuti.findOneAndUpdate(
        { _id: id, tenantID: requesterTenantID },
        payload,
        { new: true, runValidators: true },
      )
        .populate("penggunaID", "nama email")
        .populate("dicatatOleh", "nama")
        .lean();

      // Bersihkan seluruh cache terkait termasuk cache milik pemilik asli izin (oldIzin.penggunaID)
      await this.clearCache(requesterTenantID, id, oldIzin.penggunaID);
      return this._formatData(updated);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = new IzinCutiService();
