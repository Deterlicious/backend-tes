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

  // 7. Conditional Validation untuk Device ID (TAMBAHAN MUTLAK)
  // Jika akses via aplikasi, deviceID haram hukumnya kosong
  if (data.aksesType === "app" && !data.deviceID) {
    errors.push("Device ID wajib disertakan untuk akses aplikasi.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

function validatePenggunaLogin(data) {
  const errors = [];

  if (!data || Object.keys(data).length === 0) {
    return { valid: false, errors: ["Data login kosong"] };
  }

  // Mencegah Injeksi NoSQL & Whitespace pada Nama
  if (
    !data.nama ||
    typeof data.nama !== "string" ||
    validator.isEmpty(data.nama.trim())
  ) {
    errors.push(
      "Format nama tidak valid atau kosong. Nama pengguna wajib diisi.",
    );
  }

  // Mencegah Injeksi NoSQL & Whitespace pada PIN
  const isPinObject = typeof data.pin === "object";
  if (!data.pin || isPinObject || validator.isEmpty(String(data.pin).trim())) {
    errors.push("Format PIN tidak valid atau kosong. PIN wajib diisi.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

function validateDeviceAction(data) {
  const errors = [];

  if (!data.deviceID) {
    errors.push("Device ID wajib diisi.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = {
  validatePenggunaPayload,
  validatePenggunaLogin,
  validateDeviceAction,
};
