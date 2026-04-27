const mongoose = require("mongoose");
const validator = require("validator");

function validatePenggunaPayload(data, isUpdate = false) {
  const errors = [];

  // Proteksi awal jika data tidak dikirim atau kosong
  if (!data || Object.keys(data).length === 0) {
    return {
      valid: false,
      errors: ["Data pengguna tidak ditemukan atau kosong"],
    };
  }

  // 1. Mandatory Fields (Hanya saat Create)
  if (!isUpdate) {
    if (!data.nama || validator.isEmpty(data.nama + "")) {
      errors.push("nama wajib diisi");
    }
    if (!data.pin || validator.isEmpty(data.pin + "")) {
      errors.push("pin wajib diisi");
    }
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan harus format yang valid");
    }
    if (!data.roleID || !mongoose.Types.ObjectId.isValid(data.roleID)) {
      errors.push("roleID wajib diisi dan harus format yang valid");
    }
  }

  // 2. Nama Validation
  if (data.nama) {
    const namaStr = data.nama + "";
    if (namaStr.length < 3) errors.push("Nama minimal 3 karakter");
    if (namaStr.length > 50) errors.push("Nama maksimal 50 karakter");
  }

  // 3. PIN Validation
  if (data.pin) {
    const pinStr = data.pin + "";
    if (pinStr.length < 6) {
      errors.push("PIN minimal 6 karakter");
    }
    if (!validator.isNumeric(pinStr)) {
      errors.push("PIN harus berupa angka");
    }
  }

  // 4. ID Format Validation (Jika dikirim)
  if (data.roleID && !mongoose.Types.ObjectId.isValid(data.roleID)) {
    errors.push("ID Role tidak valid");
  }

  // 5. Format Pendukung
  if (data.nomorHp) {
    if (!validator.isMobilePhone(data.nomorHp + "", "id-ID")) {
      errors.push("Format nomor HP tidak valid (Gunakan format Indonesia)");
    }
  }

  if (data.status && !["aktif", "non-aktif"].includes(data.status)) {
    errors.push("Status harus 'aktif' atau 'non-aktif'");
  }

  // 6. aksesType Validation (TAMBAHAN BARU)
  if (data.aksesType && !["web", "app"].includes(data.aksesType)) {
    errors.push("aksesType harus 'web' atau 'app'");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePenggunaPayload };