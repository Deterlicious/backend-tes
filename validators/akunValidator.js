const validator = require("validator");

function validateRegister(data) {
  const errors = [];
  if (!data.email || !validator.isEmail(data.email)) errors.push("Format email tidak valid");
  if (!data.password || data.password.length < 6) errors.push("Password minimal 6 karakter");
  
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

function validateLogin(data) {
  const errors = [];
  if (!data.email || !validator.isEmail(data.email)) errors.push("Email tidak valid");
  if (!data.password) errors.push("Password wajib diisi");
  if (!data.deviceID) errors.push("deviceID wajib diisi untuk keamanan");

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

function validateDeviceAction(data) {
  const errors = [];
  if (!data.deviceID) errors.push("deviceID wajib diisi");
  
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateRegister, validateLogin, validateDeviceAction };