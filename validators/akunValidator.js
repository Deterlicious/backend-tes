const validator = require("validator");

// Validasi data registrasi akun baru
function validateRegister(data) {
  const errors = [];
  
  if (!data.email || !validator.isEmail(data.email)) {
    errors.push("Format email tidak valid.");
  }
  if (!data.password || data.password.length < 6) {
    errors.push("Password minimal 6 karakter.");
  }
  
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// Validasi data login akun
function validateLogin(data) {
  const errors = [];
  
  if (!data.email || !validator.isEmail(data.email)) {
    errors.push("Format email tidak valid.");
  }
  if (!data.password) {
    errors.push("Password wajib diisi.");
  }
  if (!data.deviceID) {
    errors.push("Device ID wajib diisi untuk identifikasi perangkat.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// Validasi aksi manajemen perangkat (tambah, hapus, atur utama)
function validateDeviceAction(data) {
  const errors = [];
  
  if (!data.deviceID) {
    errors.push("Device ID wajib diisi.");
  }
  
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateRegister, validateLogin, validateDeviceAction };