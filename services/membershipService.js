const Membership = require("../models/membershipModel");
const mongoose = require("mongoose");
const redis = require("../config/redis"); // Mengikuti path AkunService
const createError = require("http-errors");
const {
  validateMembershipPayload,
} = require("../validators/memberhsipValidator");

// Model pendukung
const PaketMembership =
  mongoose.models.PaketMembership || require("../models/paketMembershipModel");

// --- CACHE KEYS (Standar AkunService) ---
const KEY_LIST = (tenantID) => `membership:list:${tenantID}`;
const KEY_DETAIL = (id) => `membership:detail:${id}`;

class MembershipService {
  // --- CACHE HELPER ---
  async clearCache(id, tenantID) {
    if (id) await redis.del(KEY_DETAIL(id));
    if (tenantID) await redis.del(KEY_LIST(tenantID));
  }

  // --- PRIVATE LOGIC: VALIDASI MASA AKTIF ---
  async #validateExpiryLogic(paketId, tanggalMulai, tanggalKadaluarsaInput) {
    const paket = await PaketMembership.findById(paketId).lean();
    if (!paket) throw createError(400, "Paket Membership tidak ditemukan.");

    const tglMulai = new Date(tanggalMulai);
    tglMulai.setHours(0, 0, 0, 0);

    const tglSeharusnya = new Date(tglMulai);
    tglSeharusnya.setDate(tglMulai.getDate() + paket.durasiHari);
    tglSeharusnya.setHours(23, 59, 59, 999);

    const tglInput = new Date(tanggalKadaluarsaInput);
    tglInput.setHours(23, 59, 59, 999);

    if (tglInput.getTime() !== tglSeharusnya.getTime()) {
      const tglString = tglSeharusnya.toISOString().split("T")[0];
      throw createError(
        400,
        `Tanggal Kadaluarsa tidak valid. Seharusnya: ${tglString} (Paket ${paket.durasiHari} hari).`
      );
    }
  }

  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input (Ambil error pertama sesuai standar Akun)
    const validation = validateMembershipPayload(payload, false);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    // 2. Validasi Logika Bisnis
    await this.#validateExpiryLogic(
      payload.paketMembershipID,
      payload.tanggalMulai,
      payload.tanggalKadaluarsa
    );

    try {
      const newMembership = await Membership.create(payload);

      // 3. Invalidate List Cache
      await this.clearCache(null, payload.tenantID);

      return newMembership;
    } catch (error) {
      if (error.code === 11000)
        throw createError(400, "Penjualan ID sudah digunakan.");
      throw createError(500, error.message);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "Tenant ID wajib disertakan.");

    // 1. Cek Cache
    const cached = await redis.get(KEY_LIST(tenantID));
    if (cached) return JSON.parse(cached);

    // 2. Query DB dengan .lean()
    const memberships = await Membership.find({ tenantID })
      .populate("PelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur")
      .sort({ tanggalMulai: -1 })
      .lean();

    // 3. Set Cache (EX: 300 detik)
    await redis.set(KEY_LIST(tenantID), JSON.stringify(memberships), "EX", 300);

    return memberships;
  }

  // --- READ BY ID ---
  async getById(id, tenantID) {
    // 1. Cek Cache
    const cached = await redis.get(KEY_DETAIL(id));
    if (cached) {
      const data = JSON.parse(cached);
      // Security Check: Pastikan tenantID cocok (Anti-Tampering)
      if (data.tenantID.toString() !== tenantID.toString())
        throw createError(403, "Akses ditolak.");
      return data;
    }

    // 2. Query DB dengan isolasi Tenant
    const membership = await Membership.findOne({ _id: id, tenantID })
      .populate("PelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur")
      .lean();

    if (!membership) throw createError(404, "Membership tidak ditemukan.");

    // 3. Set Cache
    await redis.set(KEY_DETAIL(id), JSON.stringify(membership), "EX", 600);

    return membership;
  }

  // --- UPDATE ---
  async update(id, tenantID, payload) {
    // 1. Validasi Input
    const validation = validateMembershipPayload(payload, true);
    if (!validation.valid) throw createError(400, validation.errors[0]);

    const updates = validation.updates;

    // 2. Cek Eksistensi & Hak Akses
    const current = await Membership.findOne({ _id: id, tenantID }).lean();
    if (!current) throw createError(404, "Membership tidak ditemukan.");

    // 3. Validasi Logika Tanggal jika ada perubahan terkait
    if (
      updates.paketMembershipID ||
      updates.tanggalMulai ||
      updates.tanggalKadaluarsa
    ) {
      await this.#validateExpiryLogic(
        updates.paketMembershipID || current.paketMembershipID,
        updates.tanggalMulai || current.tanggalMulai,
        updates.tanggalKadaluarsa || current.tanggalKadaluarsa
      );
    }

    // 4. Update DB
    const updated = await Membership.findOneAndUpdate(
      { _id: id, tenantID },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    // 5. Clear Cache
    await this.clearCache(id, tenantID);

    return updated;
  }

  // --- DELETE ---
  async delete(id, tenantID) {
    // Hapus dengan filter tenantID untuk keamanan penuh
    const deleted = await Membership.findOneAndDelete({ _id: id, tenantID });
    if (!deleted)
      throw createError(404, "Data tidak ditemukan atau akses ditolak.");

    // Clear Cache
    await this.clearCache(id, tenantID);

    return { message: "Membership berhasil dihapus" };
  }
}

module.exports = new MembershipService();
