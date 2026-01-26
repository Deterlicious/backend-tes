const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUS = ["Aktif", "Non-Aktif"];

function validatePaketMembershipPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaPaket || validator.isEmpty(data.namaPaket + "")) {
      errors.push("namaPaket wajib diisi");
    }
    if (data.harga === undefined || typeof data.harga !== "number" || data.harga < 0) {
      errors.push("harga wajib diisi dan tidak boleh negatif");
    }
    if (data.durasiHari === undefined || typeof data.durasiHari !== "number" || data.durasiHari < 1) {
      errors.push("durasiHari wajib diisi dan minimal 1");
    }
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push("status tidak valid (Aktif/Non-Aktif)");
  }

  if (data.harga !== undefined && (typeof data.harga !== "number" || data.harga < 0)) {
    errors.push("harga tidak boleh negatif");
  }

  if (data.durasiHari !== undefined && (typeof data.durasiHari !== "number" || data.durasiHari < 1)) {
    errors.push("durasiHari minimal 1");
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
  validatePaketMembershipPayload
};