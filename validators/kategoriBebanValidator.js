const validator = require("validator");
const mongoose = require("mongoose");

function validateKategoriPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.namaKategori || validator.isEmpty(data.namaKategori + "")) {
      errors.push("namaKategori wajib diisi");
    }
  }

  if (data.namaKategori !== undefined && validator.isEmpty(data.namaKategori + "")) {
    errors.push("namaKategori tidak boleh kosong");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateKategoriPayload };