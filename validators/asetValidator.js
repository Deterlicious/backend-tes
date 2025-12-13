// asetValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUS = ["tersedia", "digunakan", "perbaikan"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Aset.
 */
function validateAsetPayload(data, isUpdate = false) {
  const errors = [];
  // Hapus 'tenantID' dari allowedUpdates jika Anda ingin mencegah pemindahan aset antar tenant
  const allowedUpdates = ["namaAset", "tipeAsetID", "status"];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.namaAset) errors.push("Nama Aset wajib diisi.");
    if (!data.tipeAsetID || !isValidObjectId(data.tipeAsetID))
      errors.push("Tipe Aset ID wajib diisi dan formatnya harus valid.");
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");

    // Status bersifat opsional, default "tersedia" di model
    if (data.status && !VALID_STATUS.includes(data.status))
      errors.push(`Status tidak valid. Pilihan: ${VALID_STATUS.join(", ")}.`);

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (key === "tipeAsetID" && !isValidObjectId(data[key])) {
          errors.push("Format Tipe Aset ID tidak valid.");
        } else if (key === "status" && !VALID_STATUS.includes(data[key])) {
          errors.push(
            `Status tidak valid. Pilihan: ${VALID_STATUS.join(", ")}.`
          );
        } else {
          updates[key] = data[key];
        }
      } else if (key === "tenantID") {
        errors.push(
          "Tenant ID tidak diizinkan untuk diubah setelah pembuatan aset."
        );
      } else if (key !== "_id") {
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

module.exports = { validateAsetPayload };
