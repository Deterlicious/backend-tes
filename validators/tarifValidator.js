const mongoose = require("mongoose");
const validator = require("validator");

function validateTarifPayload(data, isUpdate = false) {
  const errors = [];

  // 1. Mandatory Fields (Create Only)
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaTarif) errors.push("namaTarif wajib diisi");
    if (!data.basisPerhitungan) errors.push("basisPerhitungan wajib diisi");
    if (data.harga === undefined) errors.push("harga wajib diisi");
    if (!data.durasiMinimum) errors.push("durasiMinimum wajib diisi");
  }

  // 2. Format Validation
  if (data.basisPerhitungan && !["per jam", "per sesi"].includes(data.basisPerhitungan)) {
    errors.push("basisPerhitungan harus 'per jam' atau 'per sesi'");
  }

  if (data.harga !== undefined && (!validator.isNumeric(data.harga + "") || data.harga < 0)) {
    errors.push("Harga harus angka positif");
  }

  if (data.durasiMinimum !== undefined && (!validator.isNumeric(data.durasiMinimum + "") || data.durasiMinimum < 1)) {
    errors.push("durasiMinimum harus angka minimal 1");
  }

  // Validasi tipeAsetID (jika ada) - Pastikan array valid atau single ID valid
  if (data.tipeAsetID) {
    const ids = Array.isArray(data.tipeAsetID) ? data.tipeAsetID : [data.tipeAsetID];
    for (const id of ids) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            errors.push(`tipeAsetID tidak valid: ${id}`);
        }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateTarifPayload };