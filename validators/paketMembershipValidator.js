const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_STATUSES = ["Aktif", "Non-Aktif"];
const MIN_DURASI_HARI = 1;

/**
 * Validasi payload untuk operasi CREATE/UPDATE Paket Membership.
 * @param {object} data - req.body atau data update.
 * @param {boolean} isUpdate - Flag untuk menandakan apakah ini operasi update.
 * @returns {object} { valid: boolean, updates?: object, errors?: string[] }
 */
function validatePaketMembershipPayload(data, isUpdate = false) {
  const errors = [];
  const allowedFields = [
    "namaPaket",
    "harga",
    "durasiHari",
    "deskripsi",
    "status",
    "tenantID",
  ];
  const updates = {};

  // --- Validasi Mandatory Fields (Hanya untuk CREATE) ---
  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("Tenant ID wajib diisi dan formatnya tidak valid.");
    }
    if (!data.namaPaket) {
      errors.push("Nama Paket wajib diisi.");
    }
    if (data.harga === undefined || data.harga < 0) {
      errors.push("Harga wajib diisi dan tidak boleh negatif.");
    }
    if (data.durasiHari === undefined || data.durasiHari < MIN_DURASI_HARI) {
      errors.push(
        `Durasi hari wajib diisi dan minimal ${MIN_DURASI_HARI} hari.`
      );
    }
    if (data.status && !VALID_STATUSES.includes(data.status)) {
      errors.push(
        `Status '${data.status}' tidak valid. Pilih: ${VALID_STATUSES.join(
          " atau "
        )}.`
      );
    }

    if (errors.length > 0) return { valid: false, errors };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key)) {
      // Cek format ID di sini agar field asing (typo) tidak lolos
      if (key === "tenantID" && !isValidObjectId(data[key])) {
        errors.push("Format ID Tenant tidak valid.");
      } else if (key === "status" && !VALID_STATUSES.includes(data[key])) {
        errors.push(
          `Status '${data[key]}' tidak valid. Pilih: ${VALID_STATUSES.join(
            " atau "
          )}.`
        );
      } else if (key === "harga" && data[key] < 0) {
        errors.push("Harga tidak boleh negatif.");
      } else if (key === "durasiHari" && data[key] < MIN_DURASI_HARI) {
        errors.push(`Durasi hari minimal ${MIN_DURASI_HARI} hari.`);
      } else {
        updates[key] = data[key];
      }
    } else if (isUpdate) {
      // Jika update dan key tidak ada di allowedFields, ini adalah field asing/typo
      errors.push(`Field tidak dikenal: ${key} tidak ada dalam skema.`);
    }
  });

  if (isUpdate && Object.keys(updates).length === 0) {
    errors.push("Tidak ada data valid yang dikirimkan untuk diperbarui.");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, updates };
}

module.exports = { validatePaketMembershipPayload };
