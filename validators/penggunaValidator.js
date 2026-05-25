const mongoose = require("mongoose");
const validator = require("validator");

function validatePenggunaPayload(data, isUpdate = false) {
  const errors = [];

  if (!data || Object.keys(data).length === 0) {
    return {
      valid: false,
      errors: ["Data pengguna tidak ditemukan atau kosong"],
    };
  }

  // 1. Mandatory Fields
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

  // 4. ID Format Validation
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

  // 6. aksesType Validation (DIUBAH SESUAI SCHEMA: Mendukung Array)
  if (data.aksesType) {
    const types = Array.isArray(data.aksesType)
      ? data.aksesType
      : [data.aksesType];
    if (types.length === 0) {
      errors.push("aksesType tidak boleh kosong");
    } else {
      const validTypes = ["web", "app"];
      const isValid = types.every((t) => validTypes.includes(t));
      if (!isValid) {
        errors.push("aksesType hanya boleh berisi 'web' atau 'app'");
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

function validatePenggunaLogin(data) {
  const errors = [];

  if (!data || Object.keys(data).length === 0) {
    return { valid: false, errors: ["Data login kosong"] };
  }

  if (
    !data.nama ||
    typeof data.nama !== "string" ||
    validator.isEmpty(data.nama.trim())
  ) {
    errors.push(
      "Format nama tidak valid atau kosong. Nama pengguna wajib diisi.",
    );
  }

  const isPinObject = typeof data.pin === "object";
  if (!data.pin || isPinObject || validator.isEmpty(String(data.pin).trim())) {
    errors.push("Format PIN tidak valid atau kosong. PIN wajib diisi.");
  }

  // VALIDASI TAMBAHAN ROADMAP V1: Pastikan loginType & installationId aman
  if (!data.loginType) {
    errors.push("loginType wajib disertakan ('web' atau 'app').");
  } else {
    const types = Array.isArray(data.loginType)
      ? data.loginType
      : [data.loginType];
    const validLoginTypes = ["web", "app"];
    const isValidType = types.every((t) => validLoginTypes.includes(t));
    if (!isValidType) {
      errors.push("loginType tidak valid, harus 'web' atau 'app'.");
    } else if (types.includes("app") && !data.installationId) {
      errors.push("installationId wajib disertakan untuk akses aplikasi.");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = {
  validatePenggunaPayload,
  validatePenggunaLogin,
};
