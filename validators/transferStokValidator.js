// transferStokValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUS = ["PENDING", "DIKIRIM", "DITERIMA", "BATAL"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Transfer Stok.
 * Tipe validasi ini akan sangat bergantung pada STATUS.
 */
function validateTransferPayload(data, isUpdate = false) {
  const errors = [];
  const allowedUpdates = [
    "nomorTransfer",
    "dariLocationID",
    "keLocationID",
    "status",
    "items",
    "tanggalKirim",
    "tanggalTerima",
    "pengirimID",
    "penerimaID",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.nomorTransfer) errors.push("Nomor Transfer wajib diisi.");
    if (!data.dariLocationID || !isValidObjectId(data.dariLocationID))
      errors.push(
        "Lokasi Asal (dariLocationID) wajib diisi dan formatnya harus valid."
      );
    if (!data.keLocationID || !isValidObjectId(data.keLocationID))
      errors.push(
        "Lokasi Tujuan (keLocationID) wajib diisi dan formatnya harus valid."
      );
    if (!data.pengirimID || !isValidObjectId(data.pengirimID))
      errors.push("Pengirim ID wajib diisi dan formatnya harus valid.");
    if (!data.tanggalKirim) errors.push("Tanggal Kirim wajib diisi.");

    // Items harus ada dan berbentuk Array
    if (!Array.isArray(data.items) || data.items.length === 0)
      errors.push("Daftar item yang ditransfer wajib diisi.");

    // Validasi Item Array
    if (Array.isArray(data.items)) {
      data.items.forEach((item, index) => {
        if (!item.bahanBakuID || !isValidObjectId(item.bahanBakuID))
          errors.push(
            `Item ${index + 1}: Bahan Baku ID wajib diisi dan formatnya valid.`
          );
        if (typeof item.qtyKirim !== "number" || item.qtyKirim <= 0)
          errors.push(
            `Item ${
              index + 1
            }: Jumlah Kirim (qtyKirim) wajib diisi dan harus positif.`
          );
      });
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        // Pengecekan status
        if (key === "status" && !VALID_STATUS.includes(data[key]))
          errors.push(
            `Status tidak valid. Pilihan: ${VALID_STATUS.join(", ")}.`
          );

        // Pengecekan ID format
        if (
          (key.includes("ID") ||
            key.includes("pengirimID") ||
            key.includes("penerimaID")) &&
          data[key] &&
          !isValidObjectId(data[key])
        ) {
          errors.push(`Format ID untuk ${key} tidak valid.`);
        }

        // Pengecekan Items
        if (key === "items" && Array.isArray(data.items)) {
          data.items.forEach((item, index) => {
            // Pakai `!== undefined` — bukan falsy guard — agar qtyKirim = 0 ikut diperiksa
            // Bug lama: `item.qtyKirim && ...` melewati 0 karena 0 falsy di JS
            if (
              item.qtyKirim !== undefined &&
              (typeof item.qtyKirim !== "number" || item.qtyKirim <= 0)
            )
              errors.push(`Item ${index + 1}: qtyKirim harus positif.`);
            // qtyTerima = 0 valid (tidak ada yang diterima), jadi cukup cek !== undefined
            if (item.qtyTerima !== undefined && typeof item.qtyTerima !== "number")
              errors.push(`Item ${index + 1}: qtyTerima harus berupa angka.`);
          });
          updates[key] = data[key];
        } else {
          updates[key] = data[key];
        }
      } else if (
        key === "tenantID" ||
        key === "_id" ||
        key === "createdAt" ||
        key === "updatedAt"
      ) {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else {
        errors.push(`Field tidak dikenal: ${key}.`);
      }
    });

    if (errors.length > 0) return { valid: false, errors };
    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    return { valid: true, updates };
  }
}

module.exports = { validateTransferPayload, VALID_STATUS };
