const validator = require("validator");

// Daftar domain email disposable yang diblokir
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamail.net", "guerrillamail.org", "spam4.me", "trashmail.com",
  "trashmail.me", "trashmail.net", "dispostable.com", "maildrop.cc",
  "spamgourmet.com", "getairmail.com", "fakeinbox.com", "mailnull.com",
  "spamfree24.org", "mt2015.com", "discard.email", "spamgourmet.net",
  "10minutemail.com", "10minutemail.net", "10minemail.com", "minutemail.com",
  "getnada.com", "tempr.email", "discard.email", "mailnesia.com",
  "mailnull.com", "spamgourmet.com", "trashmail.io",
];

function isDisposableEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

// Validasi data registrasi akun baru
function validateRegister(data) {
  const errors = [];

  if (!data.email || !validator.isEmail(data.email)) {
    errors.push("Format email tidak valid.");
  } else if (isDisposableEmail(data.email)) {
    errors.push("Email dari layanan disposable tidak diizinkan.");
  }

  if (!data.password) {
    errors.push("Password wajib diisi.");
  } else if (data.password.length < 8) {
    errors.push("Password minimal 8 karakter.");
  } else if (!/[A-Z]/.test(data.password)) {
    errors.push("Password harus mengandung minimal 1 huruf kapital.");
  } else if (!/[0-9]/.test(data.password)) {
    errors.push("Password harus mengandung minimal 1 angka.");
  }

  if (data.username !== undefined && data.username !== null) {
    if (typeof data.username !== "string") {
      errors.push("Username harus berupa teks.");
    } else if (data.username.trim().length < 3) {
      errors.push("Username minimal 3 karakter.");
    } else if (data.username.length > 25) {
      errors.push("Username maksimal 25 karakter.");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// Validasi data login akun
// FIX: deviceID dihapus — login Akun SaaS tidak lagi butuh device binding
function validateLogin(data) {
  const errors = [];

  if (!data.email || !validator.isEmail(data.email)) {
    errors.push("Format email tidak valid.");
  }
  if (!data.password) {
    errors.push("Password wajib diisi.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// Validasi aksi manajemen perangkat (dipakai di penggunaService)
// function validateDeviceAction(data) {
//   const errors = [];

//   if (!data.deviceID) {
//     errors.push("Device ID wajib diisi.");
//   }

//   if (errors.length > 0) return { valid: false, errors };
//   return { valid: true };
// }

// ... (kode atas tetap sama) ...

// [PENAMBAHAN]: Validasi khusus untuk update profil akun
function validateUpdateProfile(data) {
  const errors = [];

  // Validasi email jika dikirimkan
  if (data.email !== undefined) {
    if (!validator.isEmail(data.email)) {
      errors.push("Format email baru tidak valid.");
    } else if (isDisposableEmail(data.email)) {
      errors.push("Email dari layanan disposable tidak diizinkan.");
    }
  }

  // Validasi username jika dikirimkan
  if (data.username !== undefined && data.username !== null) {
    if (typeof data.username !== "string") {
      errors.push("Username harus berupa teks.");
    } else if (data.username.trim().length < 3) {
      errors.push("Username minimal 3 karakter.");
    } else if (data.username.length > 50) {
      errors.push("Username maksimal 50 karakter.");
    }
  }

  // Validasi password baru jika dikirimkan
  if (data.password !== undefined) {
    if (!data.oldPassword) {
      errors.push("Password lama wajib diisi jika ingin mengubah password.");
    }
    if (data.password.length < 8) {
      errors.push("Password baru minimal 8 karakter.");
    } else if (!/[A-Z]/.test(data.password)) {
      errors.push("Password baru harus mengandung minimal 1 huruf kapital.");
    } else if (!/[0-9]/.test(data.password)) {
      errors.push("Password baru harus mengandung minimal 1 angka.");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

// Pastikan untuk mengekspor fungsi yang baru dibuat
module.exports = {
  validateRegister,
  validateLogin,
  // validateDeviceAction,
  validateUpdateProfile, // [PERBAIKAN]: Ekspor fungsi baru
  isDisposableEmail,
};