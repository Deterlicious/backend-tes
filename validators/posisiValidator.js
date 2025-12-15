const validator = require("validator");
const mongoose = require("mongoose");

const VALID_STATUS = ["Aktif", "Non-Aktif"];

function validatePosisiPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaPosisi || validator.isEmpty(data.namaPosisi + "")) {
      errors.push("namaPosisi wajib diisi");
    }
    if (!data.deskripsi || validator.isEmpty(data.deskripsi + "")) {
      errors.push("deskripsi wajib diisi");
    }
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push(`Status tidak valid. Pilih: ${VALID_STATUS.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePosisiPayload };