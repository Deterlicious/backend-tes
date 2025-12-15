const validator = require("validator");
const mongoose = require("mongoose");

function validatePembelianPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.akunKasID || !mongoose.Types.ObjectId.isValid(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }
    if (!data.dicatatOleh || !mongoose.Types.ObjectId.isValid(data.dicatatOleh)) {
      errors.push("dicatatOleh wajib diisi dan valid");
    }
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push("Daftar items wajib diisi minimal satu");
    }
    if (!data.supplier || validator.isEmpty(data.supplier + "")) {
      errors.push("Nama supplier wajib diisi");
    }
  }

  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      if (!item.bahanBakuID || !mongoose.Types.ObjectId.isValid(item.bahanBakuID)) {
        errors.push(`Item ke-${index + 1}: ID Bahan Baku tidak valid`);
      }
      if (item.jumlah <= 0) {
        errors.push(`Item ke-${index + 1}: Jumlah harus lebih dari 0`);
      }
      if (item.hargaBeli < 0) {
        errors.push(`Item ke-${index + 1}: Harga beli tidak boleh negatif`);
      }
    });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validatePembelianPayload };