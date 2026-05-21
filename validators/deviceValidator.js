const mongoose = require("mongoose");
const validator = require("validator");

// 1. Validasi untuk Approve dan Revoke
function validateDeviceAction(data) {
  const errors = [];

  // Pengecekan mutlak untuk installationId
  if (!data || !data.installationId || validator.isEmpty(String(data.installationId).trim())) {
    errors.push("installationId wajib disertakan dan tidak boleh kosong.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// 2. Validasi untuk Get Devices
function validateGetDevices(data) {
  const errors = [];

  // Pengecekan format MongoDB ObjectId untuk userId
  if (!data || !data.userId) {
    errors.push("userId wajib disertakan untuk melihat daftar perangkat.");
  } else if (!mongoose.Types.ObjectId.isValid(data.userId)) {
    errors.push("Format userId tidak valid.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = {
  validateDeviceAction,
  validateGetDevices,
};