const mongoose = require("mongoose");
const validator = require("validator");

function validatePenggunaPayload(data, isUpdate = false) {
  const errors = [];

  // Mandatory Fields (Create)
  if (!isUpdate) {
    if (!data.nama || validator.isEmpty(data.nama + "")) {
      errors.push("nama wajib diisi");
    }
    if (!data.pin) {
      errors.push("pin wajib diisi");
    }
  }

  // PIN Validation
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

module.exports = {
  validatePenggunaPayload,
};
