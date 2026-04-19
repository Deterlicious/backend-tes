const validator = require("validator");
const mongoose = require("mongoose");

/**
 * Validator untuk data Role
 * Sekarang mendukung validasi array permissions (bisa berupa ID maupun Nama Permission/Slug)
 */
function validateRolePayload(data, isUpdate = false) {
  const errors = [];

  // Proteksi jika data null/undefined
  if (!data) {
    return { valid: false, errors: ["Data payload tidak ditemukan"] };
  }

  // --- 1. Mandatory Fields (Hanya untuk Create) ---
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan harus format ObjectId yang valid");
    }
    if (!data.namaRole || validator.isEmpty(data.namaRole + "")) {
      errors.push("namaRole wajib diisi");
    }
  }

  // --- 2. Validasi Nama Role ---
  if (data.namaRole) {
    const namaStr = data.namaRole + "";
    if (namaStr.length < 3) {
      errors.push("Nama Role minimal 3 karakter");
    }
    if (namaStr.length > 50) {
      errors.push("Nama Role maksimal 50 karakter");
    }
  }

  // --- 3. Validasi Deskripsi (Opsional) ---
  if (data.deskripsi && (data.deskripsi + "").length > 200) {
    errors.push("Deskripsi terlalu panjang (maksimal 200 karakter)");
  }

  // --- 4. 🔥 Validasi Array Permissions (Mendukung Slug dan ID) ---
  if (data.permissions) {
    if (!Array.isArray(data.permissions)) {
      errors.push("Permissions harus berupa Array");
    } else {
      // Cek apakah setiap item adalah teks yang tidak kosong 
      // (Bisa berupa ObjectId 24 karakter, atau teks seperti "kelola-pengguna")
      const invalidItems = data.permissions.filter(
        (item) => typeof item !== "string" || item.trim() === ""
      );
      
      if (invalidItems.length > 0) {
        errors.push("Terdapat format Permission yang tidak valid (harus berupa Teks atau ID)");
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateRolePayload };