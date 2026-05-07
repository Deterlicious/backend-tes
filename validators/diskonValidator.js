const mongoose = require("mongoose");
const validator = require("validator");

const VALID_TIPE = ["persen", "nominal"];
const VALID_STATUS = ["Aktif", "Non-Aktif"];
const VALID_CAKUPAN = ["Global", "Item"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isEmptyStr = (value) =>
  value === undefined ||
  value === null ||
  validator.isEmpty(String(value).trim());

function validateDiskonPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (isEmptyStr(data.namaDiskon)) {
      errors.push("namaDiskon wajib diisi");
    }

    if (!data.cakupan || !VALID_CAKUPAN.includes(data.cakupan)) {
      errors.push("cakupan diskon wajib diisi (Global/Item)");
    }

    if (!data.tipe || !VALID_TIPE.includes(data.tipe)) {
      errors.push("tipe diskon tidak valid (persen/nominal)");
    }

    if (
      data.nilai === undefined ||
      typeof data.nilai !== "number" ||
      data.nilai < 0
    ) {
      errors.push("nilai diskon wajib diisi dan >= 0");
    } else if (data.tipe === "persen" && data.nilai > 100) {
      errors.push("Nilai diskon persen tidak boleh > 100");
    }
  }

  if (data.namaDiskon !== undefined && isEmptyStr(data.namaDiskon)) {
    errors.push("namaDiskon tidak boleh kosong");
  }

  if (data.cakupan !== undefined && !VALID_CAKUPAN.includes(data.cakupan)) {
    errors.push("cakupan diskon tidak valid (Global/Item)");
  }

  if (data.tipe !== undefined && !VALID_TIPE.includes(data.tipe)) {
    errors.push("tipe diskon tidak valid (persen/nominal)");
  }

  if (data.nilai !== undefined) {
    if (typeof data.nilai !== "number" || data.nilai < 0) {
      errors.push("nilai harus berupa angka positif");
    }

    if (
      data.tipe === "persen" &&
      typeof data.nilai === "number" &&
      data.nilai > 100
    ) {
      errors.push("Nilai diskon persen tidak boleh > 100");
    }
  }

  if (
    data.bisaDigabung !== undefined &&
    typeof data.bisaDigabung !== "boolean"
  ) {
    errors.push("bisaDigabung harus boolean (true/false)");
  }

  if (data.status !== undefined && !VALID_STATUS.includes(data.status)) {
    errors.push("status tidak valid (Aktif/Non-Aktif)");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateDiskonPayload };
