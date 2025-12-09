const mongoose = require("mongoose");

function validatePenjualanPayload(data, isUpdate = false) {
  const errors = [];
  const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (
      !data.itemPenjualan ||
      !Array.isArray(data.itemPenjualan) ||
      data.itemPenjualan.length === 0
    ) {
      errors.push("itemPenjualan wajib diisi dan tidak boleh kosong");
    } else {
      data.itemPenjualan.forEach((item, index) => {
        if (!item.produkID || !isValidObjectId(item.produkID)) {
          errors.push(`Item #${index + 1}: produkID tidak valid`);
        }
        if (!item.jumlah || item.jumlah < 1) {
          errors.push(`Item #${index + 1}: jumlah harus minimal 1`);
        }

        if (item.hargaJual !== undefined && item.hargaJual < 0) {
          errors.push(`Item #${index + 1}: hargaJual tidak boleh negatif`);
        }

        if (item.diskonID && !isValidObjectId(item.diskonID)) {
          errors.push(`Item #${index + 1}: diskonID tidak valid`);
        }
      });
    }

    if (
      data.tanggalPenjualan &&
      isNaN(new Date(data.tanggalPenjualan).getTime())
    ) {
      errors.push("tanggalPenjualan tidak valid");
    }
  }

  if (isUpdate) {
    if (data.itemPenjualan) {
      if (
        !Array.isArray(data.itemPenjualan) ||
        data.itemPenjualan.length === 0
      ) {
        errors.push("itemPenjualan tidak boleh kosong jika dikirim");
      } else {
        data.itemPenjualan.forEach((item, index) => {
          if (item.diskonID && !isValidObjectId(item.diskonID)) {
            errors.push(`Item #${index + 1}: diskonID tidak valid`);
          }
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validatePenjualanPayload };