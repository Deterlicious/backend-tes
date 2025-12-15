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

  // 2. Format Validation Standard
  if (data.basisPerhitungan && !["per jam", "per sesi"].includes(data.basisPerhitungan)) {
    errors.push("basisPerhitungan harus 'per jam' atau 'per sesi'");
  }

  if (data.harga !== undefined && (!validator.isNumeric(data.harga + "") || data.harga < 0)) {
    errors.push("Harga harus angka positif");
  }

  if (data.durasiMinimum !== undefined && (!validator.isNumeric(data.durasiMinimum + "") || data.durasiMinimum < 1)) {
    errors.push("durasiMinimum harus angka minimal 1");
  }

  // --- VALIDASI RULES ENGINE (BARU) ---

  // Validasi Hari (Array of 0-6)
  if (data.hariAktif) {
    if (!Array.isArray(data.hariAktif)) {
      errors.push("hariAktif harus berupa array angka [0-6]");
    } else {
      const invalidDays = data.hariAktif.some(d => d < 0 || d > 6);
      if (invalidDays) errors.push("hariAktif hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)");
    }
  }

  // Validasi Format Jam (HH:mm) regex
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (data.jamMulai && !timeRegex.test(data.jamMulai)) {
    errors.push("jamMulai harus format HH:mm (contoh: 08:00)");
  }
  if (data.jamSelesai && !timeRegex.test(data.jamSelesai)) {
    errors.push("jamSelesai harus format HH:mm (contoh: 23:00)");
  }

  // Validasi tipeAsetID
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