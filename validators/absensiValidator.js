const mongoose = require("mongoose");
const createError = require("http-errors");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Validasi payload untuk operasi CREATE/UPDATE Absensi.
 * @param {object} data - req.body atau data update.
 * @param {boolean} isUpdate - Flag untuk menandakan apakah ini operasi update.
 * @returns {object} { valid: boolean, updates?: object, errors?: string[] }
 */
function validateAbsensiPayload(data, isUpdate = false) {
  const errors = [];
  const allowedUpdates = [
    "waktuMasuk",
    "waktuPulang",
    "fotoMasuk",
    "fotoPulang",
    "keterangan",
    "tanggal",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (
      !data.tanggal ||
      !data.waktuMasuk ||
      !data.fotoMasuk ||
      !data.waktuPulang ||
      !data.fotoPulang ||
      !data.tenantID ||
      !data.penggunaID
    ) {
      errors.push("Semua field wajib diisi (kecuali keterangan).");
    }

    // Pengecekan ID untuk CREATE
    if (data.tenantID && !isValidObjectId(data.tenantID))
      errors.push("Format ID Tenant tidak valid.");
    if (data.penggunaID && !isValidObjectId(data.penggunaID))
      errors.push("Format ID Pengguna tidak valid.");

    if (errors.length > 0) return { valid: false, errors };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = data[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      errors.push("Tidak ada data valid yang dikirimkan untuk diperbarui.");
      return { valid: false, errors };
    }
    return { valid: true, updates };
  }

  // Jika CREATE, kembalikan valid
  return { valid: true };
}

module.exports = { validateAbsensiPayload };
