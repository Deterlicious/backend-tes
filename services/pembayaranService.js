const Pembayaran = require("../models/pembayaranModel");
const Penjualan = require("../models/penjualanModel");
const MetodePembayaran = require("../models/metodePembayaranModel");
const AkunKas = require("../models/akunKasModel");
const redis = require("../config/redis");
const { validatePembayaranPayload } = require("../validators/pembayaranValidator");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `pembayaran:list:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `pembayaran:detail:${id}`;

const INDONESIA_OFFSET_MINUTES = 7 * 60;

function toYMDIndonesia(dateObj) {
  const shifted = new Date(
    dateObj.getTime() + INDONESIA_OFFSET_MINUTES * 60 * 1000
  );

  return shifted.toISOString().slice(0, 10);
}

class PembayaranService {
  _toNumber(value) {
    if (value === undefined || value === null || value === "") return NaN;
    if (typeof value === "number") return value;

    return parseFloat(String(value).trim());
  }

  _idOnly(value) {
    if (value && typeof value === "object" && value._id) return value._id;

    return value ?? null;
  }

  _formatOutput(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) return doc.map((d) => this._formatOutput(d));

    return {
      tenantID: doc.tenantID,
      akunKasID: this._idOnly(doc.akunKasID),
      penjualanID: this._idOnly(doc.penjualanID),
      metodePembayaranID: this._idOnly(doc.metodePembayaranID),
      noReferensi: doc.noReferensi,
      tanggalBayar: doc.tanggalBayar ?? null,
      gatewayPaymentID: doc.gatewayPaymentID ?? null,
      qrString: doc.qrString ?? null,
      jumlahBayar: doc.jumlahBayar,
      status: doc.status,
      catatan: doc.catatan ?? null,
      _id: doc._id,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async _syncPenjualan(penjualanID, tenantID) {
    const penjualan = await Penjualan.findOne({ _id: penjualanID, tenantID });

    if (!penjualan) return;

    const pembayaranSukses = await Pembayaran.find({
      penjualanID,
      tenantID,
      status: "PAID",
    });

    const totalUangMasuk = pembayaranSukses.reduce(
      (acc, curr) => acc + (curr.jumlahBayar || 0),
      0
    );

    penjualan.totalDibayar = totalUangMasuk;
    await penjualan.save();

    await redis.del(`penjualan:detail:${penjualanID}`);
    await redis.del(`penjualan:tenant:${tenantID}`);
  }

  _applyTanggalBayarRules({ payload, penjualanDoc }) {
    const jenis = String(penjualanDoc.jenisTransaksi || "").toUpperCase();

    if (payload.status !== "PAID") {
      return { ok: true };
    }

    if (jenis === "POS") {
      if (!payload.tanggalBayar) {
        payload.tanggalBayar = new Date();
      }

      return { ok: true };
    }

    if (jenis === "INVOICE") {
      if (!payload.tanggalBayar) {
        return {
          ok: false,
          error: ["tanggalBayar wajib diisi manual untuk pembayaran INVOICE."],
        };
      }

      return { ok: true };
    }

    if (!payload.tanggalBayar) {
      return {
        ok: false,
        error: ["tanggalBayar wajib diisi (jenisTransaksi tidak dikenali)."],
      };
    }

    return { ok: true };
  }

  _validateTanggalBayarNotBeforePenjualan({ payload, penjualanDoc }) {
    if (!payload.tanggalBayar) {
      return { ok: true };
    }

    const tglBayar = new Date(payload.tanggalBayar);

    if (Number.isNaN(tglBayar.getTime())) {
      return { ok: false, error: ["Format tanggal bayar tidak valid."] };
    }

    const tglTransaksi = new Date(penjualanDoc.tanggalTransaksi);

    if (Number.isNaN(tglTransaksi.getTime())) {
      return { ok: true };
    }

    const bayarYMD = toYMDIndonesia(tglBayar);
    const jualYMD = toYMDIndonesia(tglTransaksi);

    if (bayarYMD < jualYMD) {
      return {
        ok: false,
        error: [
          "Tanggal pembayaran tidak boleh sebelum tanggal transaksi penjualan.",
        ],
      };
    }

    return { ok: true };
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

    const data = await Pembayaran.find({ tenantID })
      .populate("penjualanID", "_id")
      .populate("metodePembayaranID", "_id")
      .populate("akunKasID", "_id")
      .sort({ tanggalBayar: -1, createdAt: -1 })
      .lean();

    const formatted = this._formatOutput(data);

    if (formatted.length > 0) {
      await redis.set(key, JSON.stringify(formatted), "EX", 60);
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

    const data = await Pembayaran.findOne({
      _id: id,
      tenantID: requesterTenantID,
    })
      .populate("penjualanID", "_id")
      .populate("metodePembayaranID", "_id")
      .populate("akunKasID", "_id")
      .lean();

    if (!data) {
      return null;
    }

    const formatted = this._formatOutput(data);
    await redis.set(key, JSON.stringify(formatted), "EX", 60);

    return formatted;
  }

  async create(payload) {
    const validation = validatePembayaranPayload(payload);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    const [penjualanValid, metodeValid] = await Promise.all([
      Penjualan.findOne({
        _id: payload.penjualanID,
        tenantID: payload.tenantID,
      }),
      MetodePembayaran.findOne({
        _id: payload.metodePembayaranID,
        tenantID: payload.tenantID,
        isActive: true,
      }),
    ]);

    if (!penjualanValid) {
      return { error: ["ID Penjualan tidak ditemukan."] };
    }

    if (!metodeValid) {
      return {
        error: ["Metode Pembayaran tidak valid atau sedang tidak aktif."],
      };
    }

    if (metodeValid.isAutomated === true) {
      payload.status = payload.status || "PENDING";
    } else {
      payload.status = "PAID";
    }

    const tglRule = this._applyTanggalBayarRules({
      payload,
      penjualanDoc: penjualanValid,
    });

    if (!tglRule.ok) {
      return { error: tglRule.error };
    }

    const cmp = this._validateTanggalBayarNotBeforePenjualan({
      payload,
      penjualanDoc: penjualanValid,
    });

    if (!cmp.ok) {
      return { error: cmp.error };
    }

    if (
      penjualanValid.statusBayar === "PAID" ||
      penjualanValid.sisaTagihan <= 0
    ) {
      return {
        error: [
          "Penjualan ini sudah lunas. Tidak dapat menambah pembayaran baru.",
        ],
      };
    }

    const jumlahBayarNum = this._toNumber(payload.jumlahBayar);

    if (!Number.isFinite(jumlahBayarNum) || jumlahBayarNum < 0) {
      return {
        error: [
          "jumlahBayar tidak valid (harus angka dan tidak boleh negatif).",
        ],
      };
    }

    if (jumlahBayarNum > penjualanValid.sisaTagihan) {
      return {
        error: [
          `Jumlah bayar (Rp ${jumlahBayarNum}) tidak boleh melebihi sisa tagihan (Rp ${penjualanValid.sisaTagihan}).`,
        ],
      };
    }

    if (payload.akunKasID) {
      const akunKasValid = await AkunKas.findOne({
        _id: payload.akunKasID,
        tenantID: payload.tenantID,
      });

      if (!akunKasValid) {
        return { error: ["ID Akun Kas tidak ditemukan atau akses ditolak."] };
      }
    }

    payload.noReferensi = penjualanValid.noReferensi;
    payload.jumlahBayar = jumlahBayarNum;

    try {
      const created = await Pembayaran.create(payload);

      await this._syncPenjualan(payload.penjualanID, payload.tenantID);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      const result = await Pembayaran.findOne({
        _id: created._id,
        tenantID: payload.tenantID,
      })
        .populate("penjualanID", "_id")
        .populate("metodePembayaranID", "_id")
        .populate("akunKasID", "_id")
        .lean();

      return this._formatOutput(result);
    } catch (err) {
      if (err.code === 11000) {
        return {
          error: [
            "Gagal! Sistem mendeteksi sisa aturan unique lama di database. Tolong hapus index 'penjualanID_1' di MongoDB Compass pada collection pembayarans.",
          ],
        };
      }

      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validatePembayaranPayload(payload, true);

    if (!validation.valid) {
      return { error: validation.errors };
    }

    delete payload.tenantID;
    delete payload.penjualanID;
    delete payload.noReferensi;

    const pembayaranLama = await Pembayaran.findOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (!pembayaranLama) {
      return { error: ["Pembayaran tidak ditemukan."] };
    }

    const penjualanValid = await Penjualan.findOne({
      _id: pembayaranLama.penjualanID,
      tenantID: requesterTenantID,
    });

    if (!penjualanValid) {
      return { error: ["Penjualan tidak ditemukan atau akses ditolak."] };
    }

    if (payload.jumlahBayar !== undefined) {
      const jumlahBaruNum = this._toNumber(payload.jumlahBayar);

      if (!Number.isFinite(jumlahBaruNum) || jumlahBaruNum < 0) {
        return {
          error: [
            "jumlahBayar tidak valid (harus angka dan tidak boleh negatif).",
          ],
        };
      }

      const sisaTagihanMurni =
        (penjualanValid.sisaTagihan || 0) + (pembayaranLama.jumlahBayar || 0);

      if (jumlahBaruNum > sisaTagihanMurni) {
        return {
          error: [
            `Update ditolak! Jumlah bayar (Rp ${jumlahBaruNum}) melebihi sisa tagihan yang diperbolehkan (Rp ${sisaTagihanMurni}).`,
          ],
        };
      }

      payload.jumlahBayar = jumlahBaruNum;
    }

    if (payload.metodePembayaranID) {
      const metodeValid = await MetodePembayaran.findOne({
        _id: payload.metodePembayaranID,
        tenantID: requesterTenantID,
      });

      if (!metodeValid) {
        return { error: ["Metode Pembayaran tidak ditemukan."] };
      }

      if (metodeValid.isAutomated === true) {
        payload.status = payload.status || "PENDING";
      } else {
        payload.status = "PAID";
      }
    }

    const statusSetelah = payload.status || pembayaranLama.status;

    if (statusSetelah === "PAID") {
      const tmp = { ...payload, status: "PAID" };

      const tglRule = this._applyTanggalBayarRules({
        payload: tmp,
        penjualanDoc: penjualanValid,
      });

      if (!tglRule.ok) {
        return { error: tglRule.error };
      }

      if (!payload.tanggalBayar && tmp.tanggalBayar) {
        payload.tanggalBayar = tmp.tanggalBayar;
      }

      const cmp = this._validateTanggalBayarNotBeforePenjualan({
        payload: { tanggalBayar: payload.tanggalBayar },
        penjualanDoc: penjualanValid,
      });

      if (!cmp.ok) {
        return { error: cmp.error };
      }
    } else {
      const cmp = this._validateTanggalBayarNotBeforePenjualan({
        payload,
        penjualanDoc: penjualanValid,
      });

      if (!cmp.ok) {
        return { error: cmp.error };
      }
    }

    if (payload.akunKasID) {
      const akunKasValid = await AkunKas.findOne({
        _id: payload.akunKasID,
        tenantID: requesterTenantID,
      });

      if (!akunKasValid) {
        return { error: ["ID Akun Kas tidak ditemukan."] };
      }
    }

    const updated = await Pembayaran.findOneAndUpdate(
      { _id: id, tenantID: requesterTenantID },
      payload,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return null;
    }

    await this._syncPenjualan(updated.penjualanID, requesterTenantID);

    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return this._formatOutput(updated);
  }

  async delete(id, requesterTenantID) {
    const target = await Pembayaran.findOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (!target) {
      return null;
    }

    const penjualanID = target.penjualanID;

    const result = await Pembayaran.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) {
      return null;
    }

    await this._syncPenjualan(penjualanID, requesterTenantID);

    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));

    return true;
  }
}

module.exports = new PembayaranService();