const mongoose = require("mongoose");

const VALID_STATUS_PENJUALAN = ["DRAFT", "FINAL", "VOID"];
const VALID_JENIS_TRANSAKSI = ["POS", "INVOICE"];
const VALID_JENIS_PENJUALAN = ["dine-in", "takeaway", "booking"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateIdOrArray(value, label, errors) {
  if (value === undefined) return;

  if (Array.isArray(value)) {
    const invalid = value.some((x) => x && !isValidObjectId(x));

    if (invalid) {
      errors.push(`${label} mengandung ObjectId yang tidak valid`);
    }

    return;
  }

  if (value && !isValidObjectId(value)) {
    errors.push(`${label} tidak valid`);
  }
}

function isValidDate(value) {
  return !Number.isNaN(new Date(value).getTime());
}

function validatePenjualanPayload(data, isUpdate = false) {
  const errors = [];

  if (
    !isUpdate &&
    data.simpanDraft !== undefined &&
    typeof data.simpanDraft !== "boolean"
  ) {
    errors.push("simpanDraft harus boolean");
  }

  if (
    isUpdate &&
    data.finalize !== undefined &&
    typeof data.finalize !== "boolean"
  ) {
    errors.push("finalize harus boolean");
  }

  if (
    data.statusPenjualan !== undefined &&
    !VALID_STATUS_PENJUALAN.includes(data.statusPenjualan)
  ) {
    errors.push("statusPenjualan tidak valid (DRAFT/FINAL/VOID)");
  }

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.penggunaID || !isValidObjectId(data.penggunaID)) {
      errors.push("penggunaID wajib diisi dan valid");
    }

    if (!data.pelangganID || !isValidObjectId(data.pelangganID)) {
      errors.push("pelangganID wajib diisi dan valid");
    }

    if (
      !data.jenisTransaksi ||
      !VALID_JENIS_TRANSAKSI.includes(data.jenisTransaksi)
    ) {
      errors.push("jenisTransaksi wajib diisi dengan POS atau INVOICE");
    }

    if (!data.tanggalTransaksi) {
      errors.push("tanggalTransaksi wajib diisi");
    } else if (!isValidDate(data.tanggalTransaksi)) {
      errors.push("tanggalTransaksi tidak valid");
    }

    if (
      !data.jenisPenjualan ||
      !VALID_JENIS_PENJUALAN.includes(data.jenisPenjualan)
    ) {
      errors.push("jenisPenjualan wajib diisi (dine-in/takeaway/booking)");
    }

    if (data.jatuhTempo && !isValidDate(data.jatuhTempo)) {
      errors.push("jatuhTempo tidak valid");
    }

    validateIdOrArray(data.pajakTransaksiIDs, "pajakTransaksiIDs", errors);
    validateIdOrArray(data.diskonGlobalIDs, "diskonGlobalIDs", errors);

    if (
      data.jumlahDiskonTransaksi !== undefined &&
      (typeof data.jumlahDiskonTransaksi !== "number" ||
        data.jumlahDiskonTransaksi < 0)
    ) {
      errors.push(
        "jumlahDiskonTransaksi manual harus berupa angka dan tidak boleh negatif",
      );
    }

    if (
      !data.itemPenjualan ||
      !Array.isArray(data.itemPenjualan) ||
      data.itemPenjualan.length === 0
    ) {
      errors.push("itemPenjualan wajib diisi (minimal 1 produk)");
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

        if (
          item.jumlahDiskon !== undefined &&
          (typeof item.jumlahDiskon !== "number" || item.jumlahDiskon < 0)
        ) {
          errors.push(
            `Item #${index + 1}: jumlahDiskon manual harus berupa angka dan tidak boleh negatif`,
          );
        }

        validateIdOrArray(
          item.diskonItemIDs,
          `Item #${index + 1}: diskonItemIDs`,
          errors,
        );
      });
    }
  } else {
    if (data.pelangganID !== undefined && !isValidObjectId(data.pelangganID)) {
      errors.push("pelangganID tidak valid");
    }

    if (
      data.tanggalTransaksi !== undefined &&
      !isValidDate(data.tanggalTransaksi)
    ) {
      errors.push("tanggalTransaksi tidak valid");
    }

    if (data.pajakTransaksiIDs !== undefined) {
      validateIdOrArray(data.pajakTransaksiIDs, "pajakTransaksiIDs", errors);
    }

    if (data.diskonGlobalIDs !== undefined) {
      validateIdOrArray(data.diskonGlobalIDs, "diskonGlobalIDs", errors);
    }

    if (
      data.jumlahDiskonTransaksi !== undefined &&
      (typeof data.jumlahDiskonTransaksi !== "number" ||
        data.jumlahDiskonTransaksi < 0)
    ) {
      errors.push(
        "jumlahDiskonTransaksi manual harus berupa angka dan tidak boleh negatif",
      );
    }

    if (data.itemPenjualan !== undefined) {
      if (
        !Array.isArray(data.itemPenjualan) ||
        data.itemPenjualan.length === 0
      ) {
        errors.push("itemPenjualan tidak boleh kosong jika dikirim");
      } else {
        data.itemPenjualan.forEach((item, index) => {
          if (item.produkID !== undefined && !isValidObjectId(item.produkID)) {
            errors.push(`Item #${index + 1}: produkID tidak valid`);
          }

          if (
            item.jumlahDiskon !== undefined &&
            (typeof item.jumlahDiskon !== "number" || item.jumlahDiskon < 0)
          ) {
            errors.push(
              `Item #${index + 1}: jumlahDiskon manual harus berupa angka dan tidak boleh negatif`,
            );
          }

          if (item.diskonItemIDs !== undefined) {
            validateIdOrArray(
              item.diskonItemIDs,
              `Item #${index + 1}: diskonItemIDs`,
              errors,
            );
          }
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validatePenjualanPayload };