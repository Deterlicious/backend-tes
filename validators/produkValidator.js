const validator = require("validator");
const mongoose = require("mongoose");

function validateProdukPayload(data, isUpdate = false) {
  const errors = [];

  // Validasi Mandatory Fields (Create)
  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.namaProduk || validator.isEmpty(data.namaProduk + "")) {
      errors.push("namaProduk wajib diisi");
    }
    if (data.hargaJual === undefined || data.hargaJual < 0) {
      errors.push("hargaJual wajib diisi dan tidak boleh negatif");
    }
    if (data.hargaDasar === undefined || data.hargaDasar < 0) {
      errors.push("hargaDasar wajib diisi dan tidak boleh negatif");
    }
    if (!data.kategoriID || !mongoose.Types.ObjectId.isValid(data.kategoriID)) {
      errors.push("kategoriID wajib diisi dan valid");
    }
  }

  // Validasi Resep (Nested Array)
  if (data.resep && Array.isArray(data.resep)) {
    data.resep.forEach((item, index) => {
      if (!mongoose.Types.ObjectId.isValid(item.bahanBakuID)) {
        errors.push(`Resep index ${index}: bahanBakuID tidak valid`);
      }
      if (item.jumlah <= 0) {
        errors.push(`Resep index ${index}: jumlah harus lebih dari 0`);
      }
      if (!["gram", "ml", "pcs", "kg", "liter"].includes(item.satuan)) {
        errors.push(`Resep index ${index}: satuan tidak valid`);
      }
    });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateProdukPayload };