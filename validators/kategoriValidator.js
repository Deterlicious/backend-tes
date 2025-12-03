const validator = require("validator");
const mongoose = require("mongoose");

function validateKategoriPayload(data, isUpdate = false) {
  const errors = [];

  // Validasi Field Wajib saat create
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan harus valid");
    }
    if (!data.namaKategori || validator.isEmpty(data.namaKategori + "")) {
      errors.push("namaKategori wajib diisi");
    }
    if (!data.kodeKategori || validator.isEmpty(data.kodeKategori + "")) {
      errors.push("kodeKategori wajib diisi");
    }
  }

  //  Validasi Format (Create & Update)
  if (data.namaKategori && data.namaKategori.length < 2) {
    errors.push("namaKategori minimal 2 karakter");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateKategoriPayload };