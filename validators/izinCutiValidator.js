const mongoose = require("mongoose");
const validator = require("validator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["sakit", "izin", "cuti tahunan"];
const VALID_STATUS = ["diajukan", "disetujui", "ditolak"];

function validateIzinCutiPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.penggunaID || !isValidObjectId(data.penggunaID)) {
      errors.push("penggunaID wajib diisi dan valid");
    }
    if (!data.tanggalMulai) {
      errors.push("tanggalMulai wajib diisi");
    }
    if (!data.tanggalSelesai) {
      errors.push("tanggalSelesai wajib diisi");
    }
    if (!data.tipe || !VALID_TIPE.includes(data.tipe)) {
      errors.push(`tipe tidak valid (${VALID_TIPE.join(", ")})`);
    }
    if (!data.keterangan || validator.isEmpty(data.keterangan + "")) {
      errors.push("keterangan wajib diisi");
    }
  }

  if (data.tipe && !VALID_TIPE.includes(data.tipe)) {
    errors.push("tipe tidak valid");
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push("status tidak valid");
  }

  if (data.dicatatOleh && !isValidObjectId(data.dicatatOleh)) {
    errors.push("dicatatOleh tidak valid");
  }

  // Catatan: data.catatan dilewati karena boleh string, boleh null

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateIzinCutiPayload };
