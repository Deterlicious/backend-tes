const validator = require("validator");
const mongoose = require("mongoose");

function validateAbsensiPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.penggunaID || !mongoose.Types.ObjectId.isValid(data.penggunaID)) {
      errors.push("penggunaID wajib diisi dan valid");
    }

    if (!data.tanggal) {
      errors.push("tanggal wajib diisi");
    }

    if (!data.waktuMasuk) {
      errors.push("waktuMasuk wajib diisi");
    }

    if (!data.waktuPulang) {
      errors.push("waktuPulang wajib diisi");
    }

    if (!data.fotoMasuk || validator.isEmpty(data.fotoMasuk + "")) {
      errors.push("fotoMasuk wajib diisi");
    }

    if (!data.fotoPulang || validator.isEmpty(data.fotoPulang + "")) {
      errors.push("fotoPulang wajib diisi");
    }
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
  validateAbsensiPayload
};