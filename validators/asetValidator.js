const mongoose = require("mongoose");

const VALID_STATUS = ["tersedia", "digunakan", "perbaikan"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateAsetPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.namaAset) {
      errors.push("namaAset wajib diisi");
    }

    if (!data.tipeAsetID || !isValidObjectId(data.tipeAsetID)) {
      errors.push("tipeAsetID wajib diisi dan valid");
    }
  }

  if (data.tipeAsetID && !isValidObjectId(data.tipeAsetID)) {
    errors.push("tipeAsetID tidak valid");
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push(`Status tidak valid. Pilihan: ${VALID_STATUS.join(", ")}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateAsetPayload };