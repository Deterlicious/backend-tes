const validator = require("validator");

function validateTenantPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.namaToko || validator.isEmpty(data.namaToko + "")) {
      errors.push("namaToko wajib diisi");
    }
  }

  if (data.namaToko && data.namaToko.length < 3) {
    errors.push("namaToko minimal 3 karakter");
  }

  if (data.status && !["aktif", "non-aktif"].includes(data.status)) {
    errors.push("status hanya boleh 'aktif' atau 'non-aktif'");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateTenantPayload };