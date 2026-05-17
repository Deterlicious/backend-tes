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
    if (!data.keterangan || validator.isEmpty(data.keterangan + "", { ignore_whitespace: true })) {
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
  validateJurnalPayload,
  validateWmsPayload,
};

function validateWmsPayload(action, data) {
  const errors = [];
  const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

  if (action !== "opname") {
    if (!data.bahanBakuID || !isValidObjectId(data.bahanBakuID)) {
      errors.push("bahanBakuID wajib diisi dan harus ObjectId yang valid.");
    }
  }

  switch (action) {
    case "kirim":
      if (!data.dariLocationID || !isValidObjectId(data.dariLocationID)) {
        errors.push("dariLocationID wajib diisi dan harus ObjectId yang valid.");
      }
      if (!data.qtyKirim || typeof data.qtyKirim !== "number" || data.qtyKirim <= 0) {
        errors.push("qtyKirim wajib diisi dan harus angka > 0.");
      }
      if (!data.noDokumen || !data.noDokumen.toString().trim()) {
        errors.push("noDokumen (nomor surat jalan) wajib diisi.");
      }
      break;

    case "terima":
      if (!data.keLocationID || !isValidObjectId(data.keLocationID)) {
        errors.push("keLocationID wajib diisi dan harus ObjectId yang valid.");
      }
      if (!data.qtyTerima || typeof data.qtyTerima !== "number" || data.qtyTerima <= 0) {
        errors.push("qtyTerima wajib diisi dan harus angka > 0.");
      }
      if (!data.noDokumen || !data.noDokumen.toString().trim()) {
        errors.push("noDokumen (nomor surat jalan) wajib diisi.");
      }
      break;

    case "rollback":
      if (!data.dariLocationID || !isValidObjectId(data.dariLocationID)) {
        errors.push("dariLocationID wajib diisi dan harus ObjectId yang valid.");
      }
      if (!data.qtyKirim || typeof data.qtyKirim !== "number" || data.qtyKirim <= 0) {
        errors.push("qtyKirim wajib diisi dan harus angka > 0.");
      }
      if (!data.noDokumen || !data.noDokumen.toString().trim()) {
        errors.push("noDokumen (nomor transfer yang dibatalkan) wajib diisi.");
      }
      break;

    case "opname":
      if (!data.inventoryID || !isValidObjectId(data.inventoryID)) {
        errors.push("inventoryID wajib diisi dan harus ObjectId yang valid.");
      }
      if (data.fisikAktual === undefined || typeof data.fisikAktual !== "number" || data.fisikAktual < 0) {
        errors.push("fisikAktual wajib diisi dan tidak boleh negatif.");
      }
      break;

    default:
      errors.push(`Action '${action}' tidak dikenali.`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}
