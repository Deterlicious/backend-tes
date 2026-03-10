const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isEmptyStr = (value) =>
  value === undefined ||
  value === null ||
  validator.isEmpty(String(value).trim());

function validateTipeAsetPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (isEmptyStr(data.namaTipeAset)) {
      errors.push("namaTipeAset wajib diisi");
    }
  }

  if (data.namaTipeAset !== undefined) {
    if (isEmptyStr(data.namaTipeAset)) {
      errors.push("namaTipeAset tidak boleh kosong");
    } else if (String(data.namaTipeAset).trim().length < 2) {
      errors.push("namaTipeAset minimal 2 karakter");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateTipeAsetPayload };