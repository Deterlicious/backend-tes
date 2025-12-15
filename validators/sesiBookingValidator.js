const mongoose = require("mongoose");

function validateSesiBookingPayload(data, isUpdate = false) {
  const errors = [];
  const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

  if (!isUpdate) {
    if (!data.dataAset || !isValidObjectId(data.dataAset)) {
      errors.push("dataAset wajib diisi dan valid");
    }
    if (!data.penggunaID || !isValidObjectId(data.penggunaID)) {
      errors.push("penggunaID wajib diisi dan valid");
    }
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }
    if (!data.dataPelanggan || !isValidObjectId(data.dataPelanggan)) {
      errors.push("dataPelanggan wajib diisi dan valid");
    }
    if (!data.waktuMulai) {
      errors.push("waktuMulai wajib diisi");
    }
    if (data.dataDiskon && !isValidObjectId(data.dataDiskon)) {
      errors.push("dataDiskon tidak valid");
    }
    if (data.tarifID && !isValidObjectId(data.tarifID)) {
      errors.push("Format tarifID tidak valid");
    }
  }

  if (isUpdate) {
    if (data.dataAset && !isValidObjectId(data.dataAset)) {
      errors.push("dataAset tidak valid");
    }
    if (data.dataPelanggan && !isValidObjectId(data.dataPelanggan)) {
      errors.push("dataPelanggan tidak valid");
    }
    if (data.dataPenjualan && !isValidObjectId(data.dataPenjualan)) {
      errors.push("dataPenjualan tidak valid");
    }
    if (data.dataDiskon && !isValidObjectId(data.dataDiskon)) {
      errors.push("dataDiskon tidak valid");
    }
    if (data.tarifID && !isValidObjectId(data.tarifID)) {
      errors.push("Format tarifID tidak valid");
    }
  }

  if (data.waktuMulai && data.waktuSelesai) {
    const start = new Date(data.waktuMulai);
    const end = new Date(data.waktuSelesai);
    if (end <= start) {
      errors.push("waktuSelesai harus lebih besar dari waktuMulai");
    }
  } else if (isUpdate && data.waktuSelesai) {
    if (isNaN(new Date(data.waktuSelesai).getTime())) {
      errors.push("Format waktuSelesai tidak valid");
    }
  }

  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      if (item.dataDiskon && !isValidObjectId(item.dataDiskon)) {
        errors.push(`Item #${index + 1}: dataDiskon tidak valid`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validateSesiBookingPayload };
