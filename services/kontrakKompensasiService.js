const KontrakKompensasi = require("../models/kontrakKompensasiModel");
const Pengguna = require("../models/penggunaModel");
const redis = require("../config/redis");
const {
  validateKontrakPayload,
} = require("../validators/kontrakKompensasiValidator");
const cron = require("node-cron");

const KEY_LIST = (tenantID) => `kontrak:list:${tenantID}`;
const KEY_DETAIL = (id) => `kontrak:detail:${id}`;

class KontrakKompensasiService {
  constructor() {
    this._initCronJob();
  }

  _initCronJob() {
    cron.schedule("0 0 * * *", async () => {
      try {
        const sekarang = new Date();
        const hasilUpdate = await KontrakKompensasi.updateMany(
          {
            status: "Aktif",
            tanggalSelesai: { $ne: null, $lt: sekarang },
          },
          { $set: { status: "Berakhir" } },
        );

        if (hasilUpdate.modifiedCount > 0) {
          console.log(
            `[Cron Job] Berhasil memperbarui status ${hasilUpdate.modifiedCount} kontrak menjadi 'Berakhir'.`,
          );
        }
      } catch (error) {
        console.error(
          "[Cron Job] Gagal mengupdate status otomatis kontrak:",
          error,
        );
      }
    });
  }

  // --- KEMBALIKAN KE FORMAT SEMULA (Menampilkan null) ---
  _formatData(doc) {
    if (!doc) return null;

    return {
      _id: doc._id,
      tenantID: doc.tenantID,
      penggunaID: doc.penggunaID,
      jenisKontrak: doc.jenisKontrak,
      tipeGaji: doc.tipeGaji,
      tarifGaji: doc.tarifGaji,
      tanggalMulai: doc.tanggalMulai,
      tanggalSelesai: doc.tanggalSelesai, // Akan bernilai null untuk "Tetap"
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

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

    const formattedData = data.map((item) => this._formatData(item));

    if (formattedData.length > 0) {
      await redis.set(key, JSON.stringify(formattedData), "EX", 300);
    }

    return formattedData;
  }

  async getById(id, requesterTenantID) {
    const key = KEY_DETAIL(id);
    const cached = await redis.get(key);

    if (cached) return JSON.parse(cached);

    const data = await KontrakKompensasi.findOne({
      _id: id,
      tenantID: requesterTenantID,
    })
      .populate("penggunaID", "nama email role")
      .lean();

    if (!data) return null;

    const formattedData = this._formatData(data);
    await redis.set(key, JSON.stringify(formattedData), "EX", 300);
    return formattedData;
  }

  async create(payload) {
    const validation = validateKontrakPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    // --- PROTEKSI TAMBAHAN ---
    // Pastikan jika "Tetap", nilainya adalah murni null, bukan undefined atau string kosong
    if (payload.jenisKontrak === "Tetap") {
      payload.tanggalSelesai = null;
    }

    const penggunaValid = await Pengguna.findOne({
      _id: payload.penggunaID,
      tenantID: payload.tenantID,
    }).lean();

    if (!penggunaValid) {
      return {
        error: [
          "Data pengguna tidak ditemukan atau tidak berada di tenant ini.",
        ],
      };
    }

    const kontrakAktif = await KontrakKompensasi.findOne({
      tenantID: payload.tenantID,
      penggunaID: payload.penggunaID,
      status: "Aktif",
    }).lean();

    if (kontrakAktif) {
      return {
        error: [
          "Pengguna ini masih memiliki kontrak yang aktif. Harap akhiri kontrak sebelumnya terlebih dahulu.",
        ],
      };
    }

    let kontrak = await KontrakKompensasi.create(payload);
    kontrak = await kontrak.populate("penggunaID", "nama email role");

    await this.clearCache(payload.tenantID);
    return this._formatData(kontrak.toObject ? kontrak.toObject() : kontrak);
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateKontrakPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.penggunaID;

    const existing = await KontrakKompensasi.findOne({
      _id: id,
      tenantID: requesterTenantID,
    }).lean();
    if (!existing) return null;

    if (payload.tanggalMulai || payload.tanggalSelesai) {
      const start = payload.tanggalMulai
        ? new Date(payload.tanggalMulai)
        : new Date(existing.tanggalMulai);
      const end = payload.tanggalSelesai
        ? new Date(payload.tanggalSelesai)
        : existing.tanggalSelesai
          ? new Date(existing.tanggalSelesai)
          : null;

      if (end && end < start) {
        return { error: ["tanggalSelesai tidak boleh sebelum tanggalMulai"] };
      }
    }

    const updated = await KontrakKompensasi.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      { $set: payload },
      { new: true, runValidators: true },
    )
      .populate("penggunaID", "nama email role")
      .lean();

    await this.clearCache(requesterTenantID, id);
    return this._formatData(updated);
  }

  async delete(id, requesterTenantID) {
    const result = await KontrakKompensasi.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });
    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);
    return true;
  }
}

module.exports = new KontrakKompensasiService();
