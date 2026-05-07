const mongoose = require("mongoose");

const VALID_STATUS = ["Aktif", "Selesai", "Batal"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateId(value, label, errors) {
  if (value === undefined || value === null || value === "") return;

  if (!isValidObjectId(value)) {
    errors.push(`${label} tidak valid`);
  }
}

function validateIdArray(value, label, errors) {
  if (value === undefined || value === null || value === "") return;

  if (!Array.isArray(value)) {
    errors.push(`${label} harus berupa array ObjectId`);
    return;
  }

  const invalid = value.some((x) => x && !isValidObjectId(x));

  if (invalid) {
    errors.push(`${label} mengandung ObjectId yang tidak valid`);
  }
}

function validateDate(value, label, errors) {
  if (value === undefined || value === null || value === "") return;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    errors.push(`Format ${label} tidak valid`);
  }
}

function validateWaktuRange(waktuMulai, waktuSelesai, errors, prefix = "") {
  if (!waktuMulai || !waktuSelesai) return;

  const start = new Date(waktuMulai);
  const end = new Date(waktuSelesai);

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    // 1. Waktu selesai harus masuk akal (lebih besar dari waktu mulai)
    if (end <= start) {
      errors.push(`${prefix}waktuSelesai harus lebih besar dari waktuMulai`);
    }

    // 2. Batas 3 bulan mundur SUDAH DIHAPUS. Pengguna bebas menginput tanggal ke masa lalu.
  }
}

function validateSesiBookingPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.dataPengguna || !isValidObjectId(data.dataPengguna)) {
      errors.push("dataPengguna wajib diisi dan valid");
    }

    if (!data.dataPelanggan || !isValidObjectId(data.dataPelanggan)) {
      errors.push("dataPelanggan wajib diisi dan valid");
    }

    if (!data.dataAset || !isValidObjectId(data.dataAset)) {
      errors.push("dataAset wajib diisi dan valid");
    }

    if (!data.waktuMulai) {
      errors.push("waktuMulai wajib diisi");
    } else {
      validateDate(data.waktuMulai, "waktuMulai", errors);
    }

    if (!data.waktuSelesai) {
      errors.push("waktuSelesai wajib diisi");
    } else {
      validateDate(data.waktuSelesai, "waktuSelesai", errors);
    }

    if (data.dataTarif !== undefined) {
      validateId(data.dataTarif, "dataTarif", errors);
    }

    if (data.diskonItem !== undefined) {
      validateIdArray(data.diskonItem, "diskonItem", errors);
    }

    if (data.diskonGlobal !== undefined) {
      validateIdArray(data.diskonGlobal, "diskonGlobal", errors);
    }

    if (data.status !== undefined && !VALID_STATUS.includes(data.status)) {
      errors.push("status tidak valid (Aktif/Selesai/Batal)");
    }

    if (
      data.simpanDraft !== undefined &&
      typeof data.simpanDraft !== "boolean"
    ) {
      errors.push("simpanDraft harus boolean");
    }

    if (
      data.noReferensi !== undefined &&
      String(data.noReferensi).trim() === ""
    ) {
      errors.push("noReferensi tidak boleh kosong jika dikirim");
    }
  } else {
    validateId(data.dataAset, "dataAset", errors);
    validateId(data.dataPelanggan, "dataPelanggan", errors);
    validateId(data.dataTarif, "dataTarif", errors);

    if (data.dataPenjualan !== undefined) {
      errors.push("dataPenjualan tidak boleh diubah melalui endpoint ini");
    }

    validateDate(data.waktuMulai, "waktuMulai", errors);
    validateDate(data.waktuSelesai, "waktuSelesai", errors);

    if (data.diskonItem !== undefined) {
      validateIdArray(data.diskonItem, "diskonItem", errors);
    }

    if (data.diskonGlobal !== undefined) {
      validateIdArray(data.diskonGlobal, "diskonGlobal", errors); // Diperbaiki dari data.disglobal
    }

    if (data.status !== undefined && !VALID_STATUS.includes(data.status)) {
      errors.push("status tidak valid (Aktif/Selesai/Batal)");
    }
  }

  validateWaktuRange(data.waktuMulai, data.waktuSelesai, errors);

  if (data.items !== undefined) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      errors.push("items wajib berupa array dan tidak boleh kosong");
    } else {
      data.items.forEach((item, index) => {
        const prefix = `Item #${index + 1}: `;

        if (!item.dataAset || !isValidObjectId(item.dataAset)) {
          errors.push(`${prefix}dataAset wajib diisi dan valid`);
        }

        if (!item.waktuMulai) {
          errors.push(`${prefix}waktuMulai wajib diisi`);
        } else if (Number.isNaN(new Date(item.waktuMulai).getTime())) {
          errors.push(`${prefix}Format waktuMulai tidak valid`);
        }

        if (!item.waktuSelesai) {
          errors.push(`${prefix}waktuSelesai wajib diisi`);
        } else if (Number.isNaN(new Date(item.waktuSelesai).getTime())) {
          errors.push(`${prefix}Format waktuSelesai tidak valid`);
        }

        validateWaktuRange(item.waktuMulai, item.waktuSelesai, errors, prefix);

        if (
          item.dataTarif !== undefined &&
          item.dataTarif !== null &&
          item.dataTarif !== ""
        ) {
          if (!isValidObjectId(item.dataTarif)) {
            errors.push(`${prefix}dataTarif tidak valid`);
          }
        }

        if (item.diskonItem !== undefined) {
          if (!Array.isArray(item.diskonItem)) {
            errors.push(`${prefix}diskonItem harus berupa array`);
          } else if (item.diskonItem.some((x) => x && !isValidObjectId(x))) {
            errors.push(`${prefix}diskonItem mengandung ObjectId tidak valid`);
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSesiBookingPayload };
