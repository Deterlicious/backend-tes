const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const VALID_TIPE = ["Per Produk", "Per Transaksi"];
const VALID_MODEL = [1, 2, 3];
const VALID_PRIORITAS = [1, 2];

function validatePajakPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.namaPajak || String(data.namaPajak).trim().length === 0) {
      errors.push("namaPajak wajib diisi");
    }

    if (data.tarifPajak === undefined || typeof data.tarifPajak !== "number") {
      errors.push("tarifPajak wajib diisi (angka)");
    }

    if (
      data.modelPerhitungan === undefined ||
      !VALID_MODEL.includes(data.modelPerhitungan)
    ) {
      errors.push(
        "modelPerhitungan wajib diisi (1=Inclusive, 2=Exclusive, 3=Compound)",
      );
    }

    if (
      data.prioritas === undefined ||
      !VALID_PRIORITAS.includes(data.prioritas)
    ) {
      errors.push("prioritas wajib diisi (1 atau 2)");
    }

    // if (!data.akunPajakID) {
    //   // akunPajakID opsional — akan di-set nanti jika ada
    // } else if (!isValidObjectId(data.akunPajakID)) {
    //   errors.push("akunPajakID tidak valid");
    // }
  }

  if (data.tarifPajak !== undefined) {
    if (typeof data.tarifPajak !== "number" || data.tarifPajak < 0) {
      errors.push("tarifPajak harus angka >= 0");
    }

    if (data.tarifPajak > 100) {
      errors.push("tarifPajak tidak boleh > 100%");
    }
  }

  if (
    data.modelPerhitungan !== undefined &&
    !VALID_MODEL.includes(data.modelPerhitungan)
  ) {
    errors.push("modelPerhitungan tidak valid (1/2/3)");
  }

  if (
    data.prioritas !== undefined &&
    !VALID_PRIORITAS.includes(data.prioritas)
  ) {
    errors.push("prioritas tidak valid (1/2)");
  }

  if (data.tipePajak !== undefined) {
    if (typeof data.tipePajak !== "boolean") {
      errors.push(
        "tipePajak harus bernilai boolean (true untuk Produk, false untuk Transaksi)",
      );
    }
  } else {
    // Hanya jika sedang proses CREATE
    errors.push("tipePajak wajib diisi");
  }

  // if (data.akunPajakID && !isValidObjectId(data.akunPajakID)) {
  //   errors.push("akunPajakID tidak valid");
  // }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validatePajakPayload };
