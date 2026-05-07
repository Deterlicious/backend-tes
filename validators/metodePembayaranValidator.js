const mongoose = require("mongoose");
const validator = require("validator");

const VALID_KATEGORI = ["non-tunai", "tunai"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateMetodePembayaranPayload(data, isUpdate = false) {
  const errors = [];
  const isAutomated = data.isAutomated === true;

  const isEmpty = (val) => validator.isEmpty(String(val ?? ""));

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.namaPembayaran || isEmpty(data.namaPembayaran)) {
      errors.push("namaPembayaran wajib diisi");
    }

    if (!data.akunKasID || !isValidObjectId(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }

    if (!data.kategori || !VALID_KATEGORI.includes(data.kategori)) {
      errors.push(
        `Kategori tidak valid. Pilihan: ${VALID_KATEGORI.join(", ")}`,
      );
    }
  } else if (data.kategori && !VALID_KATEGORI.includes(data.kategori)) {
    errors.push(`Kategori tidak valid. Pilihan: ${VALID_KATEGORI.join(", ")}`);
  }

  if (isAutomated) {
    if (data.kategori === "tunai") {
      errors.push("Metode Xendit tidak boleh menggunakan kategori tunai");
    }

    if (!data.xenditChannelCode || isEmpty(data.xenditChannelCode)) {
      errors.push("xenditChannelCode wajib diisi untuk metode Xendit");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateMetodePembayaranPayload };
