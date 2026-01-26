const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUS = ["Aktif", "Kadaluarsa"];

function validateMembershipPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.pelangganID || !isValidObjectId(data.pelangganID)) {
      errors.push("pelangganID wajib diisi dan valid");
    }
    if (!data.paketMembershipID || !isValidObjectId(data.paketMembershipID)) {
      errors.push("paketMembershipID wajib diisi dan valid");
    }
    if (!data.penjualanID || !isValidObjectId(data.penjualanID)) {
      errors.push("penjualanID wajib diisi dan valid");
    }
    if (!data.tanggalMulai) {
      errors.push("tanggalMulai wajib diisi");
    }
    if (!data.tanggalKadaluarsa) {
      errors.push("tanggalKadaluarsa wajib diisi");
    }
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push("status tidak valid");
  }

  if (data.paketMembershipID && !isValidObjectId(data.paketMembershipID)) {
    errors.push("paketMembershipID tidak valid");
  }

  if (data.tanggalMulai && data.tanggalKadaluarsa) {
    if (new Date(data.tanggalKadaluarsa) <= new Date(data.tanggalMulai)) {
      errors.push("tanggalKadaluarsa harus lebih besar dari tanggalMulai");
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
  validateMembershipPayload
};