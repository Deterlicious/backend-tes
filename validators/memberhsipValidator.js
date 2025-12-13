// membershipValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUSES = ["Aktif", "Kadaluarsa"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Membership.
 * @param {object} data - req.body atau data update.
 * @param {boolean} isUpdate - Flag untuk menandakan apakah ini operasi update.
 * @returns {object} { valid: boolean, updates?: object, errors?: string[] }
 */
function validateMembershipPayload(data, isUpdate = false) {
  const errors = [];
  // Disertakan untuk menghapus field yang tidak boleh diubah (seperti penjualanID, PelangganID)
  const immutableFields = ["PelangganID", "penjualanID", "tenantID", "_id"];
  const allowedUpdates = [
    "paketMembershipID",
    "tanggalMulai",
    "tanggalKadaluarsa",
    "status",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID))
      errors.push("Tenant ID wajib diisi dan formatnya tidak valid.");
    if (!data.PelangganID || !isValidObjectId(data.PelangganID))
      errors.push("Pelanggan ID wajib diisi dan formatnya tidak valid.");
    if (!data.paketMembershipID || !isValidObjectId(data.paketMembershipID))
      errors.push("Paket Membership ID wajib diisi dan formatnya tidak valid.");
    if (!data.penjualanID || !isValidObjectId(data.penjualanID))
      errors.push("Penjualan ID wajib diisi dan formatnya tidak valid.");
    if (!data.tanggalMulai) errors.push("Tanggal Mulai wajib diisi.");
    if (!data.tanggalKadaluarsa) errors.push("Tanggal Kadaluarsa wajib diisi.");
    if (data.status && !VALID_STATUSES.includes(data.status))
      errors.push(
        `Status '${data.status}' tidak valid. Pilih: ${VALID_STATUSES.join(
          " atau "
        )}.`
      );

    if (errors.length > 0) return { valid: false, errors };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (immutableFields.includes(key)) {
        // Mencegah perubahan field yang tidak boleh diubah
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      } else if (allowedUpdates.includes(key)) {
        if (key === "status" && !VALID_STATUSES.includes(data[key])) {
          errors.push(
            `Status '${data[key]}' tidak valid. Pilih: ${VALID_STATUSES.join(
              " atau "
            )}.`
          );
        } else if (key === "paketMembershipID" && !isValidObjectId(data[key])) {
          errors.push(`Format ID ${key} tidak valid.`);
        } else {
          updates[key] = data[key];
        }
      } else {
        // Field Asing/Typos
        errors.push(`Field tidak dikenal: ${key} tidak ada dalam skema.`);
      }
    });

    if (errors.length > 0) return { valid: false, errors };
    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, updates };
  }

  return { valid: true };
}

module.exports = { validateMembershipPayload };
