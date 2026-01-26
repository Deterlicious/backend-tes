const Membership = require("../models/membershipModel");
const PaketMembership = require("../models/paketMembershipModel");
const redis = require("../config/redis");
const {
  validateMembershipPayload
} = require("../validators/membershipValidator");
const createError = require("http-errors");

const KEY_LIST = (tenantID) => `membership:list:${tenantID}`;
const KEY_DETAIL = (id) => `membership:detail:${id}`;

class MembershipService {
  async clearCache(tenantID, id) {
    const keys = [KEY_LIST(tenantID)];
    if (id) keys.push(KEY_DETAIL(id));

    await redis.del(keys);
  }

  async _validateExpiryLogic(paketId, tglMulaiInput, tglKadaluarsaInput) {
    const paket = await PaketMembership.findById(paketId).lean();
    if (!paket) throw createError(400, "Paket Membership tidak ditemukan");

    const tglMulai = new Date(tglMulaiInput);
    tglMulai.setHours(0, 0, 0, 0);

    const tglSeharusnya = new Date(tglMulai);
    tglSeharusnya.setDate(tglMulai.getDate() + paket.durasiHari);
    tglSeharusnya.setHours(23, 59, 59, 999);

    const tglInput = new Date(tglKadaluarsaInput);
    tglInput.setHours(23, 59, 59, 999);

    if (tglInput.toDateString() !== tglSeharusnya.toDateString()) {
      throw createError(400, `Tanggal Kadaluarsa tidak valid. Paket ${paket.durasiHari} hari, seharusnya berakhir pada ${tglSeharusnya.toDateString()}`);
    }
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID required");

    const key = KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await Membership.find({
        tenantID
      })
      .populate("pelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur")
      .sort({
        tanggalMulai: -1
      })
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

    const data = await Membership.findOne({
        _id: id,
        tenantID: requesterTenantID,
      })
      .populate("pelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur")
      .lean();

    if (!data) return null;

    await redis.set(key, JSON.stringify(data), "EX", 300);
    return data;
  }

  async create(payload) {
    const validation = validateMembershipPayload(payload);
    if (!validation.valid) return {
      error: validation.errors
    };

    try {
      await this._validateExpiryLogic(
        payload.paketMembershipID,
        payload.tanggalMulai,
        payload.tanggalKadaluarsa
      );

      const newMembership = await Membership.create(payload);
      await this.clearCache(payload.tenantID);

      return newMembership;
    } catch (err) {
      if (err.code === 11000) {
        throw createError(400, "Membership untuk ID Penjualan ini sudah ada");
      }
      throw err;
    }
  }

  async update(id, payload, requesterTenantID) {
    const validation = validateMembershipPayload(payload, true);
    if (!validation.valid) return {
      error: validation.errors
    };

    delete payload.tenantID;
    delete payload.penjualanID;
    delete payload.pelangganID;

    try {
      const current = await Membership.findOne({
        _id: id,
        tenantID: requesterTenantID
      });
      if (!current) return null;

      if (payload.paketMembershipID || payload.tanggalMulai || payload.tanggalKadaluarsa) {
        await this._validateExpiryLogic(
          payload.paketMembershipID || current.paketMembershipID,
          payload.tanggalMulai || current.tanggalMulai,
          payload.tanggalKadaluarsa || current.tanggalKadaluarsa
        );
      }

      const updated = await Membership.findOneAndUpdate({
        _id: id,
        tenantID: requesterTenantID,
      }, payload, {
        new: true,
        runValidators: true,
      }).lean();

      await this.clearCache(requesterTenantID, id);

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id, requesterTenantID) {
    const result = await Membership.deleteOne({
      _id: id,
      tenantID: requesterTenantID,
    });

    if (result.deletedCount === 0) return null;

    await this.clearCache(requesterTenantID, id);

    return true;
  }
}

module.exports = new MembershipService();