// membershipService.js
const Membership = require("../models/membershipModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const {
  validateMembershipPayload,
} = require("../validators/memberhsipValidator"); // Import Validator

// Asumsi model PaketMembership diimpor di scope ini (diperlukan untuk CREATE/UPDATE)
const PaketMembership =
  mongoose.models.PaketMembership || require("../models/paketMembershipModel");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Helper untuk menghitung dan membandingkan tanggal kadaluarsa.
 * @throws {Error} Jika tanggal kadaluarsa tidak sesuai.
 */
async function validateExpiryLogic(
  paketId,
  tanggalMulai,
  tanggalKadaluarsaInput
) {
  const paket = await PaketMembership.findById(paketId);
  if (!paket) throw createError(400, "Paket Membership tidak ditemukan.");

  const tglMulai = new Date(tanggalMulai);
  tglMulai.setHours(0, 0, 0, 0);

  const tglKadaluarsaSeharusnya = new Date(tglMulai);
  tglKadaluarsaSeharusnya.setDate(tglMulai.getDate() + paket.durasiHari);
  tglKadaluarsaSeharusnya.setHours(23, 59, 59, 999);

  const tglKadaluarsaInput = new Date(tanggalKadaluarsaInput);
  const tglKadaluarsaInputNormalized = new Date(tglKadaluarsaInput);
  tglKadaluarsaInputNormalized.setHours(23, 59, 59, 999);

  if (
    tglKadaluarsaInputNormalized.getTime() !== tglKadaluarsaSeharusnya.getTime()
  ) {
    const tglSeharusnyaString = tglKadaluarsaSeharusnya
      .toISOString()
      .split("T")[0];
    throw createError(400, {
      message: "Tanggal Kadaluarsa tidak sesuai dengan durasi paket.",
      error: `Tanggal Kadaluarsa seharusnya: ${tglSeharusnyaString} (berdasarkan paket ${paket.durasiHari} hari).`,
    });
  }
}

class MembershipService {
  // --- CREATE ---
  async create(payload) {
    // 1. Validasi Input Dasar
    const validation = validateMembershipPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    // 2. Validasi Logika Bisnis Tanggal (Memanggil helper)
    await validateExpiryLogic(
      payload.paketMembershipID,
      payload.tanggalMulai,
      payload.tanggalKadaluarsa
    );

    try {
      const membership = await Membership.create(payload);
      return membership;
    } catch (error) {
      if (error.code === 11000) {
        throw createError(
          400,
          `Gagal menambahkan. Penjualan ID '${payload.penjualanID}' sudah digunakan.`
        );
      }
      throw createError(500, error.message);
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    const membership = await Membership.find({ tenantID })
      .populate("PelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur")
      .sort({ tanggalMulai: -1 });

    if (membership.length === 0)
      throw createError(404, "Tidak ada data Membership untuk tenant ini.");

    return membership;
  }

  // --- READ BY ID ---
  async getById(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    const membership = await Membership.findById(id)
      .populate("PelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur");

    if (!membership) throw createError(404, "Membership tidak ditemukan.");
    return membership;
  }

  // --- UPDATE ---
  async update(id, payload) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    // 1. Validasi Input & Whitelisting/Field Asing Check
    const validation = validateMembershipPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    const updates = validation.updates;

    // 2. Validasi Logika Khusus (Tanggal/Paket Membership)
    if (
      updates.paketMembershipID ||
      updates.tanggalMulai ||
      updates.tanggalKadaluarsa
    ) {
      const currentMembership = await Membership.findById(id);
      if (!currentMembership)
        throw createError(404, "Membership tidak ditemukan.");

      const newPaketID =
        updates.paketMembershipID || currentMembership.paketMembershipID;
      const newTanggalMulai =
        updates.tanggalMulai || currentMembership.tanggalMulai;
      const newTanggalKadaluarsa =
        updates.tanggalKadaluarsa || currentMembership.tanggalKadaluarsa;

      // Validasi ulang dengan data yang sudah digabungkan (lama + baru)
      await validateExpiryLogic(
        newPaketID,
        newTanggalMulai,
        newTanggalKadaluarsa
      );
    }

    try {
      const membership = await Membership.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
        context: "query",
      });

      if (!membership) throw createError(404, "Membership tidak ditemukan");

      return membership;
    } catch (error) {
      if (error.name === "ValidationError") {
        throw createError(400, {
          message: "Validasi gagal.",
          errors: error.errors,
        });
      }
      throw createError(400, error.message);
    }
  }

  // --- DELETE ---
  async delete(id) {
    if (!isValidObjectId(id)) throw createError(400, "Format ID tidak valid.");

    const membership = await Membership.findById(id);
    if (!membership) throw createError(404, "Membership tidak ditemukan");

    await Membership.findByIdAndDelete(id);

    // NOTE: Di sini Anda mungkin perlu menambahkan logika bisnis
    // seperti membatalkan status member pada dokumen Pelanggan yang bersangkutan.

    return { message: "Membership berhasil dihapus" };
  }
}

module.exports = new MembershipService();
