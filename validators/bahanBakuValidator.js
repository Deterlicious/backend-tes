const validator = require("validator");
const mongoose = require("mongoose");

const VALID_UNITS = ["kg", "gram", "liter", "ml", "pcs", "pak", "unit"];

function validateBahanBakuPayload(data, isUpdate = false) {
  const errors = [];

  // Validasi Mandatory Fields (Create)
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaBahan || validator.isEmpty(data.namaBahan + "")) {
      errors.push("namaBahan wajib diisi");
    }
    if (!data.satuan || !VALID_UNITS.includes(data.satuan)) {
      errors.push(`satuan tidak valid. Pilih: ${VALID_UNITS.join(", ")}`);
    }
  }

  // Validasi Format (Update & Create)
  if (data.stok !== undefined && data.stok < 0) {
    errors.push("stok tidak boleh negatif");
  }

  if (data.satuan && !VALID_UNITS.includes(data.satuan)) {
    errors.push(`satuan tidak valid. Pilih: ${VALID_UNITS.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateBahanBakuPayload };
