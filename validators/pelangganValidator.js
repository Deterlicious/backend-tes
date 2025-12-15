const validator = require("validator");
const mongoose = require("mongoose");
const VALID_TYPES = ["umum", "korporat", "member"];

function validatePelangganPayload(data, isUpdate = false) {
  const errors = [];
  if (data.nomorHp === "" || data.nomorHp === null) delete data.nomorHp;
  if (data.email === "" || data.email === null) delete data.email;
  if (data.alamat === "" || data.alamat === null) delete data.alamat;

  if (!isUpdate) {
    if (!data.tenantID) errors.push("tenantID wajib diisi");
    if (!data.namaPelanggan) errors.push("namaPelanggan wajib diisi");
    if (!data.tipePelanggan) errors.push("tipePelanggan wajib diisi");
  }

  if (data.email && !validator.isEmail(data.email)) {
    errors.push("Format email tidak valid");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePelangganPayload };