// izinCutiValidator.js
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_TIPE = ["sakit", "izin", "cuti tahunan"];
const VALID_STATUS = ["diajukan", "disetujui", "ditolak"];

/**
 * Validasi payload untuk operasi CREATE/UPDATE Izin Cuti.
 */
function validateIzinCutiPayload(data, isUpdate = false) {
  const errors = [];
  const allowedUpdates = [
    "tanggalMulai",
    "tanggalSelesai",
    "tipe",
    "status",
    "keterangan",
    "dicatatOleh",
  ];
  const updates = {};

  // Helper untuk validasi ObjectId
  const checkObjectId = (key, value) => {
    if (value && !isValidObjectId(value)) {
      errors.push(`Format ID untuk ${key} tidak valid.`);
      return false;
    }
    return true;
  };

  // --- Validasi CREATE ---
  if (!isUpdate) {
    // Wajib ada
    if (!data.penggunaID) errors.push("Pengguna ID wajib diisi.");
    if (!data.tanggalMulai) errors.push("Tanggal Mulai wajib diisi.");
    if (!data.tanggalSelesai) errors.push("Tanggal Selesai wajib diisi.");
    if (!data.tipe) errors.push("Tipe Cuti wajib diisi.");
    if (!data.keterangan) errors.push("Keterangan wajib diisi.");
    if (!data.tenantID) errors.push("Tenant ID wajib diisi.");

    // Validasi Format ID
    if (data.penggunaID && !isValidObjectId(data.penggunaID))
      errors.push("Format Pengguna ID tidak valid.");
    if (data.tenantID && !isValidObjectId(data.tenantID))
      errors.push("Format Tenant ID tidak valid.");
    if (data.dicatatOleh && !isValidObjectId(data.dicatatOleh))
      errors.push("Format ID Pencatat tidak valid.");

    // Validasi Tipe & Status
    if (data.tipe && !VALID_TIPE.includes(data.tipe))
      errors.push("Tipe izin/cuti tidak valid.");
    if (data.status && !VALID_STATUS.includes(data.status))
      errors.push("Status izin/cuti tidak valid.");

    // Validasi Logika Tanggal
    if (data.tanggalMulai && data.tanggalSelesai) {
      const start = new Date(data.tanggalMulai);
      const end = new Date(data.tanggalSelesai);
      if (end < start)
        errors.push("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    }

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true };
  }

  // --- Validasi UPDATE ---
  if (isUpdate) {
    Object.keys(data).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (key === "dicatatOleh" && !checkObjectId(key, data[key])) return;

        if (key === "tipe" && !VALID_TIPE.includes(data[key])) {
          errors.push("Tipe izin/cuti tidak valid.");
        } else if (key === "status" && !VALID_STATUS.includes(data[key])) {
          errors.push("Status izin/cuti tidak valid.");
        } else {
          updates[key] = data[key];
        }
      } else if (key === "penggunaID" || key === "tenantID" || key === "_id") {
        errors.push(`Field '${key}' tidak diizinkan untuk diubah.`);
      }
    });

    // Validasi Logika Tanggal pada UPDATE (Logika ini akan diurus di Service menggunakan data lama)
    // Kita hanya melakukan check format dasar di sini.

    if (Object.keys(updates).length === 0)
      errors.push("Tidak ada data valid untuk diperbarui.");

    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, updates };
  }
}

module.exports = { validateIzinCutiPayload };
