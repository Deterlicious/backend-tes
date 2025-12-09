const mongoose = require("mongoose");
const validator = require("validator");

function validateTipeAsetPayload(data, isUpdate = false) {
  const errors = [];

  // 1. Mandatory Fields (Create Only)
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaTipeAset || validator.isEmpty(data.namaTipeAset + "")) {
      errors.push("namaTipeAset wajib diisi");
    }
  }

  // 2. Format Validation
  if (data.namaTipeAset && data.namaTipeAset.length < 2) {
    errors.push("namaTipeAset minimal 2 karakter");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateTipeAsetPayload };