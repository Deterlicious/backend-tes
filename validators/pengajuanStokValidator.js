// pengajuanStokValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Permintaan Stok.
 */
function validatePengajuanStokPayload(data, isUpdate = false) {
  const errors = [];
  const allowedUpdates = [
    "nomorPengajuan",
    "jenisPengajuan",
    "dariLocationID",
    "keLocationID",
    "status",
    "items",
    "diprosesOleh",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya harus valid.");
    if (!data.nomorPengajuan) errors.push("Nomor Request wajib diisi.");
    if (!data.dariLocationID || !isValidObjectId(data.dariLocationID))
      errors.push(
        "Lokasi Asal Permintaan (dariLocationID) wajib diisi dan valid."
      );
    if (!data.keLocationID || !isValidObjectId(data.keLocationID))
      errors.push("Lokasi Tujuan Stok (keLocationID) wajib diisi dan valid.");
    if (!data.dimintaOleh || !isValidObjectId(data.dimintaOleh))
      errors.push("ID Peminta (dimintaOleh) wajib diisi dan valid.");

    // Items harus ada dan berbentuk Array
    if (!Array.isArray(data.items) || data.items.length === 0)
      errors.push("Daftar item permintaan wajib diisi.");

    // Validasi Item Array
    if (Array.isArray(data.items)) {
      data.items.forEach((item, index) => {
        if (!item.bahanBakuID || !isValidObjectId(item.bahanBakuID))
          errors.push(
            `Item ${index + 1}: Bahan Baku ID wajib diisi dan valid.`
          );
        if (typeof item.qtyRequest !== "number" || item.qtyRequest <= 0)
          errors.push(
            `Item ${
              index + 1
            }: Jumlah Request (qtyRequest) wajib diisi dan harus positif.`
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
        if (key.includes("ID") && data[key] && !isValidObjectId(data[key])) {
          errors.push(`Format ID untuk ${key} tidak valid.`);
        }

        // Pengecekan Items untuk Update (khusus APPROVED)
        if (key === "items" && Array.isArray(data.items)) {
          data.items.forEach((item, index) => {
            if (
              item.qtyApproved &&
              (typeof item.qtyApproved !== "number" || item.qtyApproved < 0)
            )
              errors.push(
                `Item ${index + 1}: qtyApproved harus berupa angka non-negatif.`
              );
          });
          updates[key] = data[key];
        } else {
          updates[key] = data[key];
        }
      } else if (
        key === "tenantID" ||
        key === "_id" ||
        key === "createdAt" ||
        key === "updatedAt" ||
        key === "transferStokID"
      ) {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else {
        updates[key] = data[key];
      }
    });

    if (errors.length > 0) return { valid: false, errors };
    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    return { valid: true, updates };
  }
}

module.exports = { validatePengajuanStokPayload, VALID_STATUS };
