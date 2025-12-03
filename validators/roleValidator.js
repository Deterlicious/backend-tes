const validator = require("validator");
const mongoose = require("mongoose");

function validateRolePayload(data, isUpdate = false) {
  const errors = [];

  // Mandatory Fields (Create)
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaRole || validator.isEmpty(data.namaRole + "")) {
      errors.push("namaRole wajib diisi");
    }
  }

  // Format Validation
  if (data.namaRole && data.namaRole.length < 3) {
    errors.push("Nama Role minimal 3 karakter");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateRolePayload };