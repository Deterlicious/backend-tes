// inventoryValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Validasi payload untuk operasi CREATE/UPDATE Inventory.
 */
function validateInventoryPayload(data, isUpdate = false) {
  const errors = [];
  const allowedUpdates = ["stok"]; // Umumnya hanya stok yang diubah, ID tidak boleh
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.bahanBakuID || !isValidObjectId(data.bahanBakuID))
      errors.push("Bahan Baku ID wajib diisi dan formatnya harus valid.");
    if (!data.locationID || !isValidObjectId(data.locationID))
      errors.push("Location ID wajib diisi dan formatnya harus valid.");
    if (typeof data.stok !== "number" || data.stok < 0)
      errors.push("Stok wajib diisi dan harus berupa angka non-negatif.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (
          key === "stok" &&
          (typeof data[key] !== "number" || data[key] < 0)
        ) {
          errors.push("Stok harus berupa angka non-negatif.");
        } else {
          updates[key] = data[key];
        }
      } else if (
        key === "tenantID" ||
        key === "_id" ||
        key === "bahanBakuID" ||
        key === "locationID"
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

module.exports = { validateInventoryPayload };
