// akunKasValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE_AKUN = ["Kas Fisik", "Rekening Bank"];
const VALID_STATUS = ["aktif", "non-aktif"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Akun Kas.
 * Mencakup field yang ada di skema: namaAkun, saldo, tipeAkun, status, nomorAkun, keterangan, tenantID.
 * @param {object} data - req.body atau data update.
 * @param {boolean} isUpdate - Flag untuk menandakan apakah ini operasi update.
 * @returns {object} { valid: boolean, updates?: object, errors?: string[] }
 */
function validateAkunKasPayload(data, isUpdate = false) {
  const errors = [];

  // Daftar field yang boleh di-update oleh user
  const allowedUpdates = [
    "namaAkun",
    "saldo", // Boleh diubah, meskipun seharusnya via Transaksi
    "tipeAkun",
    "status",
    "nomorAkun",
    "keterangan",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya tidak valid.");
    if (!data.namaAkun) errors.push("Nama Akun wajib diisi.");
    if (!data.nomorAkun) errors.push("Nomor Akun wajib diisi.");
    if (!data.tipeAkun || !VALID_TIPE_AKUN.includes(data.tipeAkun))
      errors.push(
        `Tipe Akun '${
          data.tipeAkun
        }' tidak valid. Pilih: ${VALID_TIPE_AKUN.join(" atau ")}.`
      );
    // Note: Saldo, status memiliki default di model, jadi tidak wajib dicek di sini.

    if (errors.length > 0) return { valid: false, errors };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        // Pengecekan Tipe Akun/Status
        if (key === "tipeAkun" && !VALID_TIPE_AKUN.includes(data[key])) {
          errors.push(`Tipe Akun '${data[key]}' tidak valid.`);
        } else if (key === "status" && !VALID_STATUS.includes(data[key])) {
          errors.push(`Status '${data[key]}' tidak valid.`);
        } else if (key === "saldo" && typeof data[key] !== "number") {
          errors.push("Saldo harus berupa angka.");
        } else {
          updates[key] = data[key];
        }
      } else if (key === "_id" || key === "createdAt" || key === "updatedAt") {
        // Field yang diabaikan/dilarang diubah
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else {
        // Field Asing/Typos
        errors.push(`Field tidak dikenal: ${key}.`);
      }
    });

    if (errors.length > 0) return { valid: false, errors };
    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, updates };
  }

  return { valid: true };
}

module.exports = { validateAkunKasPayload };
