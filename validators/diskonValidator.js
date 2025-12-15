const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["persen", "nominal"];
const VALID_STATUS = ["Aktif", "Non-Aktif"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Diskon.
 */
function validateDiskonPayload(data, isUpdate = false) {
  const errors = [];

  // Field yang boleh di-update.
  const allowedUpdates = ["namaDiskon", "tipe", "nilai", "status"];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.namaDiskon) errors.push("Nama Diskon wajib diisi.");

    // Pengecekan Tipe
    if (!data.tipe || !VALID_TIPE.includes(data.tipe))
      errors.push(
        `Tipe diskon tidak valid. Pilih salah satu: ${VALID_TIPE.join(
          " atau "
        )}.`
      );

    // Pengecekan Nilai
    if (typeof data.nilai !== "number" || data.nilai <= 0)
      errors.push("Nilai diskon wajib diisi dan harus berupa angka positif.");

    // Logika Bisnis: Jika tipe=persentase, nilai tidak boleh > 100
    if (data.tipe === "persentase" && data.nilai > 100)
      errors.push("Nilai diskon persentase tidak boleh lebih dari 100.");

    // Status bersifat opsional, default di model
    if (data.status && !VALID_STATUS.includes(data.status))
      errors.push(
        `Status tidak valid. Pilihan: ${VALID_STATUS.join(" atau ")}.`
      );

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (key === "tipe" && !VALID_TIPE.includes(data[key])) {
          errors.push(`Tipe diskon tidak valid.`);
        } else if (key === "status" && !VALID_STATUS.includes(data[key])) {
          errors.push(`Status tidak valid.`);
        } else if (key === "nilai") {
          if (typeof data[key] !== "number" || data[key] <= 0) {
            errors.push("Nilai diskon harus berupa angka positif.");
          }
          // Catatan: Pengecekan nilai > 100% akan ditangani oleh Mongoose Validator atau di layer Service jika membutuhkan data lama (old document)
        }

        // Jika tidak ada error, masukkan ke updates
        if (!errors.length || errors.slice(-1)[0].indexOf(key) === -1) {
          updates[key] = data[key];
        }
      } else if (key === "tenantID" || key === "_id") {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else {
        errors.push(`Field tidak dikenal: ${key}.`);
      }
    });

    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, updates };
  }
}

module.exports = { validateDiskonPayload };
