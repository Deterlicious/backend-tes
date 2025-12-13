// bebanOperasionalValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Validasi payload untuk operasi CREATE/UPDATE Beban Operasional.
 */
function validateBebanPayload(data, isUpdate = false) {
  const errors = [];

  // Field yang boleh di-update. Perhatikan: akunKasID & kategoriBebanID boleh diubah.
  const allowedUpdates = [
    "jumlah",
    "tanggal",
    "keterangan",
    "akunKasID",
    "kategoriBebanID",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.jumlah || typeof data.jumlah !== "number" || data.jumlah <= 0)
      errors.push("Jumlah Beban wajib diisi dan harus lebih dari nol.");
    if (!data.akunKasID || !isValidObjectId(data.akunKasID))
      errors.push(
        "Akun Kas ID (sumber dana) wajib diisi dan formatnya harus valid."
      );
    if (!data.kategoriBebanID || !isValidObjectId(data.kategoriBebanID))
      errors.push("Kategori Beban ID wajib diisi dan formatnya harus valid.");
    if (!data.tanggal) errors.push("Tanggal transaksi wajib diisi.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (
          (key === "akunKasID" || key === "kategoriBebanID") &&
          !isValidObjectId(data[key])
        ) {
          errors.push(`Format ID untuk ${key} tidak valid.`);
        } else if (
          key === "jumlah" &&
          (typeof data[key] !== "number" || data[key] <= 0)
        ) {
          errors.push("Jumlah Beban harus berupa angka positif.");
        } else {
          updates[key] = data[key];
        }
      } else if (key === "tenantID" || key === "_id") {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else if (key !== "dicatatOleh") {
        errors.push(`Field tidak dikenal: ${key}.`);
      }
    });

    if (errors.length > 0) return { valid: false, errors };
    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, updates };
  }
}

module.exports = { validateBebanPayload };
