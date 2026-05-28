const mongoose = require("mongoose");
const validator = require("validator");

const VALID_KATEGORI = ["non-tunai", "tunai"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateMetodePembayaranPayload(data, isUpdate = false) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      valid: false,
      errors: ["Payload tidak valid"],
    };
  }

  const errors = [];
  const isAutomated = data.isAutomated === true;

  const isEmpty = (val) => validator.isEmpty(String(val ?? "").trim());

  const isString = (val) => typeof val === "string";

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!isString(data.namaPembayaran)) {
      errors.push("Format namaPembayaran tidak valid");
    } else if (isEmpty(data.namaPembayaran)) {
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
  } else {
    if (data.namaPembayaran !== undefined && !isString(data.namaPembayaran)) {
      errors.push("Format namaPembayaran tidak valid");
    }

    if (
      data.namaPembayaran !== undefined &&
      isString(data.namaPembayaran) &&
      isEmpty(data.namaPembayaran)
    ) {
      errors.push("namaPembayaran wajib diisi");
    }

    if (data.akunKasID && !isValidObjectId(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }

    if (data.kategori && !VALID_KATEGORI.includes(data.kategori)) {
      errors.push(
        `Kategori tidak valid. Pilihan: ${VALID_KATEGORI.join(", ")}`,
      );
    }
  }

  if (isAutomated) {
    if (data.kategori === "tunai") {
      errors.push("Metode Xendit tidak boleh menggunakan kategori tunai");
    }

    if (!isString(data.xenditChannelCode)) {
      errors.push("Format xenditChannelCode tidak valid");
    } else if (isEmpty(data.xenditChannelCode)) {
      errors.push("xenditChannelCode wajib diisi untuk metode Xendit");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateMetodePembayaranPayload };
