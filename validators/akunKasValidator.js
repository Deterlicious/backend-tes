const mongoose = require("mongoose");
const validator = require("validator");

const VALID_TIPE_AKUN = ["Kas Fisik", "Rekening Bank"];
const VALID_STATUS = ["aktif", "non-aktif"];

function validateAkunKasPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaAkun || validator.isEmpty(data.namaAkun + "")) {
      errors.push("namaAkun wajib diisi");
    }
    if (!data.nomorAkun || validator.isEmpty(data.nomorAkun + "")) {
      errors.push("nomorAkun wajib diisi");
    }
    if (!data.tipeAkun || !VALID_TIPE_AKUN.includes(data.tipeAkun)) {
      errors.push("tipeAkun tidak valid");
    }
  }

  if (data.tipeAkun && !VALID_TIPE_AKUN.includes(data.tipeAkun)) {
    errors.push("tipeAkun tidak valid");
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push("status tidak valid");
  }

  if (data.saldo !== undefined && (typeof data.saldo !== 'number' || data.saldo < 0)) {
    errors.push("saldo harus berupa angka dan tidak boleh negatif");
  }

  if (errors.length > 0) return {
    valid: false,
    errors
  };
  return {
    valid: true
  };
}

module.exports = {
  validateAkunKasPayload
};