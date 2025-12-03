const validator = require("validator");

function validatePermissionPayload(data) {
  const errors = [];

  if (!data.nama || validator.isEmpty(data.nama + "")) {
    errors.push("Nama permission wajib diisi");
  }

  if (!data.grup || validator.isEmpty(data.grup + "")) {
    errors.push("Grup permission wajib diisi");
  }

  // Validasi format nama (misal: hanya huruf kecil dan dash, contoh: "kelola-staff")
  if (data.nama && !/^[a-z0-9-]+$/.test(data.nama)) {
    errors.push("Format nama permission harus lowercase dan dash (contoh: kelola-stok)");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePermissionPayload };