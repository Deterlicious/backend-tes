const validator = require("validator");
const mongoose = require("mongoose");

function validateJurnalTransferPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (
      !data.kasSumberID ||
      !mongoose.Types.ObjectId.isValid(data.kasSumberID)
    ) {
      errors.push("kasSumberID wajib diisi dan valid");
    }
    if (
      !data.kasTujuanID ||
      !mongoose.Types.ObjectId.isValid(data.kasTujuanID)
    ) {
      errors.push("kasTujuanID wajib diisi dan valid");
    }
    if (
      !data.dicatatOleh ||
      !mongoose.Types.ObjectId.isValid(data.dicatatOleh)
    ) {
      errors.push("dicatatOleh wajib diisi dan valid");
    }
    if (data.jumlah === undefined || data.jumlah < 1) {
      errors.push("jumlah wajib diisi dan minimal 1");
    }
    if (!data.keterangan || validator.isEmpty(data.keterangan + "")) {
      errors.push("keterangan wajib diisi");
    }

    if (
      data.kasSumberID &&
      data.kasTujuanID &&
      data.kasSumberID === data.kasTujuanID
    ) {
      errors.push("Kas Sumber dan Kas Tujuan tidak boleh sama");
    }
  }

  if (data.jumlah !== undefined && data.jumlah < 1) {
    errors.push("jumlah tidak boleh kurang dari 1");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateJurnalTransferPayload };