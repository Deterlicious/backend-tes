// validators/permissionValidator.js
const validator = require("validator");

function validatePermissionPayload(data) {
  const errors = [];

  // --- 0. Proteksi Awal ---
  if (!data || Object.keys(data).length === 0) {
    return {
      valid: false,
      errors: ["Payload tidak boleh kosong"],
    };
  }

  // --- 1. Required Fields ---
  if (!data.nama || validator.isEmpty(data.nama + "")) {
    errors.push("Nama permission wajib diisi");
  }

  if (!data.grup || validator.isEmpty(data.grup + "")) {
    errors.push("Grup permission wajib diisi");
  }

  // --- 2. Validasi Panjang ---
  if (data.nama) {
    const nama = data.nama + "";
    if (nama.length < 3) errors.push("Nama permission minimal 3 karakter");
    if (nama.length > 50) errors.push("Nama permission maksimal 50 karakter");
  }

  if (data.grup) {
    const grup = data.grup + "";
    if (grup.length < 3) errors.push("Nama grup minimal 3 karakter");
    if (grup.length > 50) errors.push("Nama grup maksimal 50 karakter");
  }

  // --- 3. Format Nama (Slug / Kebab-case) ---
  if (data.nama) {
    const nama = data.nama + "";
    if (!/^[a-z0-9-]+$/.test(nama)) {
      errors.push(
        "Format nama permission harus lowercase dan dash (contoh: read-permission)"
      );
    }
  }

  // --- 4. Deskripsi Opsional ---
  if (data.deskripsi && (data.deskripsi + "").length > 200) {
    errors.push("Deskripsi maksimal 200 karakter");
  }

  // --- Final ---
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validatePermissionPayload };