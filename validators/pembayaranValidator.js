const validator = require("validator");
const mongoose = require("mongoose");

const VALID_METODE = ["tunai", "qris_xendit", "kartu_debit"];
const VALID_STATUS = ["PAID", "PENDING", "EXPIRED", "FAILED"];

function validatePembayaranPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.penjualanID || !mongoose.Types.ObjectId.isValid(data.penjualanID)) {
      errors.push("penjualanID wajib diisi dan valid");
    }

    if (!data.akunKasID || !mongoose.Types.ObjectId.isValid(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }

    if (data.jumlahBayar === undefined || data.jumlahBayar < 0) {
      errors.push("jumlahBayar wajib diisi dan tidak boleh negatif");
    }

    if (!data.metodeBayar || !VALID_METODE.includes(data.metodeBayar)) {
      errors.push(`Metode bayar tidak valid. Pilihan: ${VALID_METODE.join(", ")}`);
    }
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push(`Status tidak valid. Pilihan: ${VALID_STATUS.join(", ")}`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePembayaranPayload };