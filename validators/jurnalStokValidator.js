// jurnalStokValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["Masuk", "Keluar"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Jurnal Stok.
 */
function validateJurnalPayload(data, isUpdate = false) {
  const errors = [];

  // Field yang boleh di-update. Catatan: bahanBakuID dan tipe umumnya tidak boleh diubah setelah dibuat.
  const allowedUpdates = ["tanggal", "jumlah", "keterangan", "dicatatOleh"];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.bahanBakuID || !isValidObjectId(data.bahanBakuID))
      errors.push("Bahan Baku ID wajib diisi dan formatnya harus valid.");
    if (!data.tipeKoreksi || !VALID_TIPE.includes(data.tipeKoreksi))
      errors.push(`Tipe Jurnal tidak valid. Pilih: ${VALID_TIPE.join(", ")}.`);
    if (typeof data.jumlah !== "number" || data.jumlah <= 0)
      errors.push("Jumlah wajib diisi dan harus berupa angka positif.");
    if (!data.tanggal) errors.push("Tanggal transaksi wajib diisi.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (key === "dicatatOleh" && data[key] && !isValidObjectId(data[key])) {
          errors.push("Format ID Pencatat tidak valid.");
        } else if (
          key === "jumlah" &&
          (typeof data[key] !== "number" || data[key] <= 0)
        ) {
          errors.push("Jumlah harus berupa angka positif.");
        } else {
          updates[key] = data[key];
        }
      } else if (
        key === "tenantID" ||
        key === "_id" ||
        key === "bahanBakuID" ||
        key === "tipe"
      ) {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else {
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

module.exports = { validateJurnalPayload };
