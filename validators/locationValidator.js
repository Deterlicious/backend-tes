// locationValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["GUDANG", "OUTLET"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Lokasi.
 */
function validateLocationPayload(data, isUpdate = false) {
  const errors = [];
  const allowedUpdates = ["nama", "tipe", "alamat"];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.nama || data.nama.trim() === "")
      errors.push("Nama lokasi wajib diisi.");
    if (!data.alamat || data.alamat.trim() === "")
      errors.push("Alamat wajib diisi.");
    if (!data.tipe || !VALID_TIPE.includes(data.tipe))
      errors.push(`Tipe lokasi tidak valid. Pilih: ${VALID_TIPE.join(", ")}.`);

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (key === "tipe" && !VALID_TIPE.includes(data[key])) {
          errors.push(
            `Tipe lokasi tidak valid. Pilih: ${VALID_TIPE.join(", ")}.`
          );
        } else if (key === "nama" && data[key].trim() === "") {
          errors.push("Nama lokasi tidak boleh kosong.");
        } else if (key === "alamat" && data[key].trim() === "") {
          errors.push("Alamat tidak boleh kosong.");
        } else {
          updates[key] = data[key];
        }
      } else if (
        key === "tenantID" ||
        key === "_id" ||
        key === "createdAt" ||
        key === "updatedAt"
      ) {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else {
        errors.push(`Field tidak dikenal: ${key}.`);
      }
    });

    if (errors.length > 0) return { valid: false, errors };
    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    return { valid: true, updates };
  }
}

module.exports = { validateLocationPayload };
