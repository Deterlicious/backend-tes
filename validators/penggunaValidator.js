const validator = require("validator");
const mongoose = require("mongoose");

function validatePenggunaPayload(data, isUpdate = false) {
  const errors = [];

  // Mandatory Fields (Create)
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.nama || validator.isEmpty(data.nama + "")) {
      errors.push("nama wajib diisi");
    }
    if (!data.pin) {
      errors.push("pin wajib diisi");
    }
  }

  // Format Validation (Create & Update)
  if (data.pin) {
    if (data.pin.length < 6) {
      errors.push("PIN minimal 6 karakter");
    }
    if (!validator.isNumeric(data.pin)) {
      errors.push("PIN harus berupa angka");
    }
  }

  if (data.nomorHp && !validator.isMobilePhone(data.nomorHp, "id-ID")) {
    errors.push("Format nomor HP tidak valid");
  }

  if (data.status && !["aktif", "non-aktif"].includes(data.status)) {
    errors.push("Status harus aktif atau non-aktif");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

function validateLoginPayload(data) {
  const errors = [];
  if (!data.pin) errors.push("PIN wajib diisi");
  if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
    errors.push("Tenant ID tidak valid");
  }
  
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePenggunaPayload, validateLoginPayload };