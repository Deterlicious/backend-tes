const validator = require("validator");
const mongoose = require("mongoose");

const ALLOWED_FIELDS = ["tenantID", "namaRole", "deskripsi", "permissions"];

function validateRolePayload(data, isUpdate = false) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Payload tidak valid"] };
  }

  // ==========================================
  // 1. DETEKSI FIELD ILEGAL (TYPO CHECK)
  // ==========================================
  const incomingFields = Object.keys(data);

  const invalidFields = incomingFields.filter(
    (key) => !ALLOWED_FIELDS.includes(key),
  );

  if (invalidFields.length > 0) {
    return {
      valid: false,
      errors: invalidFields.map(
        (f) => `Field '${f}' tidak dikenal. Gunakan hanya field yang valid.`,
      ),
    };
  }

  // ==========================================
  // 2. REQUIRED FIELD (CREATE ONLY)
  // ==========================================
  if (!isUpdate) {
    if (!data.namaRole || validator.isEmpty(String(data.namaRole))) {
      errors.push("namaRole wajib diisi");
    }

    if (!data.permissions || !Array.isArray(data.permissions)) {
      errors.push("permissions wajib berupa array dan tidak boleh kosong");
    } else if (data.permissions.length === 0) {
      errors.push("permissions wajib memiliki minimal 1 item");
    }
  }

  // ==========================================
  // 3. VALIDASI NAMA ROLE
  // ==========================================
  if (data.namaRole) {
    const val = String(data.namaRole);

    if (val.length < 3) {
      errors.push("namaRole minimal 3 karakter");
    }

    if (val.length > 50) {
      errors.push("namaRole maksimal 50 karakter");
    }
  }

  // ==========================================
  // 4. VALIDASI PERMISSIONS (FORMAT SAJA)
  // ==========================================
  if (data.permissions) {
    if (!Array.isArray(data.permissions)) {
      errors.push("permissions harus berupa array");
    } else {
      const invalid = data.permissions.filter(
        (p) => typeof p !== "string" || p.trim() === "",
      );

      if (invalid.length > 0) {
        errors.push("permissions mengandung format tidak valid");
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateRolePayload };
