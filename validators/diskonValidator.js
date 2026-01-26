const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["persen", "nominal"];
const VALID_STATUS = ["Aktif", "Non-Aktif"];

function validateDiskonPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaDiskon || validator.isEmpty(data.namaDiskon + "")) {
      errors.push("namaDiskon wajib diisi");
    }
    if (!data.tipe || !VALID_TIPE.includes(data.tipe)) {
      errors.push("tipe diskon tidak valid (persen/nominal)");
    }
    if (data.nilai === undefined || typeof data.nilai !== "number" || data.nilai < 0) {
      errors.push("nilai diskon wajib diisi dan >= 0");
    }
  }

  if (data.tipe && !VALID_TIPE.includes(data.tipe)) {
    errors.push("tipe diskon tidak valid");
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push("status tidak valid (Aktif/Non-Aktif)");
  }

  if (data.nilai !== undefined) {
    if (typeof data.nilai !== "number" || data.nilai < 0) {
      errors.push("nilai harus berupa angka positif");
    }
    if (data.tipe === "persen" && data.nilai > 100) {
      errors.push("Nilai diskon persen tidak boleh > 100");
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
  validateDiskonPayload
};