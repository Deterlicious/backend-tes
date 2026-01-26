const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateBebanPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.dicatatOleh || !isValidObjectId(data.dicatatOleh)) {
      errors.push("dicatatOleh wajib diisi dan valid");
    }
    if (!data.jumlah || typeof data.jumlah !== "number" || data.jumlah <= 0) {
      errors.push("jumlah wajib diisi dan harus angka > 0");
    }
    if (!data.akunKasID || !isValidObjectId(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }
    if (!data.kategoriBebanID || !isValidObjectId(data.kategoriBebanID)) {
      errors.push("kategoriBebanID wajib diisi dan valid");
    }
    if (!data.tanggal) {
      errors.push("tanggal wajib diisi");
    }
    if (!data.keterangan || validator.isEmpty(data.keterangan + "")) {
      errors.push("keterangan wajib diisi");
    }
  }

  if (data.jumlah !== undefined && (typeof data.jumlah !== "number" || data.jumlah <= 0)) {
    errors.push("jumlah harus angka > 0");
  }

  if (data.akunKasID && !isValidObjectId(data.akunKasID)) {
    errors.push("akunKasID tidak valid");
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
  validateBebanPayload
};