const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["Masuk", "Keluar"];
const VALID_ALASAN = ["Stok Opname", "Rusak/Hilang", "Transfer Gudang", "Lainnya"];

function validateJurnalPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.bahanBakuID || !isValidObjectId(data.bahanBakuID)) {
      errors.push("bahanBakuID wajib diisi dan valid");
    }
    if (!data.locationID || !isValidObjectId(data.locationID)) {
      errors.push("locationID wajib diisi dan valid");
    }
    if (!data.tipeKoreksi || !VALID_TIPE.includes(data.tipeKoreksi)) {
      errors.push(`tipeKoreksi tidak valid (${VALID_TIPE.join(", ")})`);
    }
    if (!data.alasan || !VALID_ALASAN.includes(data.alasan)) {
      errors.push(`alasan tidak valid`);
    }
    if (data.jumlah === undefined || typeof data.jumlah !== "number" || data.jumlah <= 0) {
      errors.push("jumlah wajib diisi dan harus angka > 0");
    }
    if (!data.tanggal) {
      errors.push("tanggal wajib diisi");
    }
  }

  if (data.alasan === "Lainnya") {
    if (!data.keterangan || validator.isEmpty(data.keterangan + "")) {
      errors.push("keterangan wajib diisi jika alasan adalah 'Lainnya'");
    }
  }

  if (data.jumlah !== undefined && (typeof data.jumlah !== "number" || data.jumlah <= 0)) {
    errors.push("jumlah harus angka > 0");
  }

  if (data.tipeKoreksi && !VALID_TIPE.includes(data.tipeKoreksi)) {
    errors.push("tipeKoreksi tidak valid");
  }

  if (errors.length > 0) return {
    valid: false,
    errors
  };
  return {
    valid: true
  };
}

module.exports = {
  validateJurnalPayload
};