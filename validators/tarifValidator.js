const mongoose = require("mongoose");
const validator = require("validator");

const VALID_BASIS_PERHITUNGAN = ["per jam", "per sesi"];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateTarifPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.namaTarif) {
      errors.push("namaTarif wajib diisi");
    }

    if (!data.basisPerhitungan) {
      errors.push("basisPerhitungan wajib diisi");
    }

    if (data.harga === undefined) {
      errors.push("harga wajib diisi");
    }

    if (!data.durasiMinimum) {
      errors.push("durasiMinimum wajib diisi");
    }
  }

  if (
    data.basisPerhitungan &&
    !VALID_BASIS_PERHITUNGAN.includes(data.basisPerhitungan)
  ) {
    errors.push("basisPerhitungan harus 'per jam' atau 'per sesi'");
  }

  if (
    data.harga !== undefined &&
    (!validator.isNumeric(String(data.harga)) || data.harga < 0)
  ) {
    errors.push("Harga harus angka positif");
  }

  if (
    data.durasiMinimum !== undefined &&
    (!validator.isNumeric(String(data.durasiMinimum)) || data.durasiMinimum < 1)
  ) {
    errors.push("durasiMinimum harus angka minimal 1");
  }

  if (data.hariAktif) {
    if (!Array.isArray(data.hariAktif)) {
      errors.push("hariAktif harus berupa array angka [0-6]");
    } else {
      const invalidDays = data.hariAktif.some((day) => day < 0 || day > 6);

      if (invalidDays) {
        errors.push(
          "hariAktif hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)",
        );
      }
    }
  }

  if (data.jamMulai && !TIME_REGEX.test(data.jamMulai)) {
    errors.push("jamMulai harus format HH:mm (contoh: 08:00)");
  }

  if (data.jamSelesai && !TIME_REGEX.test(data.jamSelesai)) {
    errors.push("jamSelesai harus format HH:mm (contoh: 23:00)");
  }

  // LOGIKA BARU: Validasi Perbandingan Waktu
  if (data.jamMulai && data.jamSelesai) {
    if (TIME_REGEX.test(data.jamMulai) && TIME_REGEX.test(data.jamSelesai)) {
      if (data.jamMulai >= data.jamSelesai) {
        errors.push("jamMulai harus lebih awal dari jamSelesai");
      }
    }
  }

  if (data.tipeAsetID) {
    const ids = Array.isArray(data.tipeAsetID)
      ? data.tipeAsetID
      : [data.tipeAsetID];

    for (const id of ids) {
      if (!isValidObjectId(id)) {
        errors.push(`tipeAsetID tidak valid: ${id}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateTarifPayload };
