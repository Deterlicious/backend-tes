const mongoose = require("mongoose");
const createError = require("http-errors"); // Diimpor, meskipun tidak digunakan untuk error validation

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 *
 * @param {object} data - req.body atau data update.
 * @param {boolean} isUpdate - Flag untuk menandakan apakah ini operasi update.
 * @returns {object} { valid: boolean, updates?: object, errors?: string[] }
 */
function validateLaporanBulananPayload(data, isUpdate = false) {
  const errors = [];
  const updates = {};

  // Daftar semua field yang diizinkan dalam Model Laporan Bulanan
  const allowedFields = [
    "laporanBulananID",
    "tenantID",
    "bulan",
    "tahun",
    "jumlahTransaksi",
    "totalOmzet",
    "totalHPP",
    "totalLabaKotor",
    "totalBebanOperasional",
    "totalLabaBersih",
    "totalUangKeluarBulanan", // Field tambahan jika ada
  ];

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    // Pengecekan Ketersediaan Field Kritis
    if (
      !data.laporanBulananID ||
      !data.tenantID ||
      !data.bulan ||
      !data.tahun
    ) {
      errors.push("laporanBulananID, tenantID, bulan, dan tahun wajib diisi.");
    }

    // Pengecekan Format ID dan Tipe Data
    if (data.tenantID && !isValidObjectId(data.tenantID)) {
      errors.push("Format ID Tenant tidak valid.");
    }
    if (
      data.bulan &&
      (typeof data.bulan !== "number" || data.bulan < 1 || data.bulan > 12)
    ) {
      errors.push("Bulan harus berupa angka antara 1 sampai 12.");
    }
    if (data.tahun && (typeof data.tahun !== "number" || data.tahun < 2000)) {
      errors.push("Tahun harus berupa angka yang valid (min 2000).");
    }

    if (errors.length > 0) return { valid: false, errors };

    // Whitelisting data CREATE
    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = data[key];
      }
    });

    return { valid: true, updates };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    let updateFound = false;

    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key)) {
        // Pengecekan Tipe dan Format saat Update
        if (key === "tenantID" && !isValidObjectId(data[key])) {
          errors.push("Format ID Tenant tidak valid.");
        } else if (
          key === "bulan" &&
          (typeof data[key] !== "number" || data[key] < 1 || data[key] > 12)
        ) {
          errors.push("Bulan harus berupa angka antara 1 sampai 12.");
        } else if (
          key === "tahun" &&
          (typeof data[key] !== "number" || data[key] < 2000)
        ) {
          errors.push("Tahun harus berupa angka yang valid (min 2000).");
        } else if (
          typeof data[key] === "number" &&
          data[key] < 0 &&
          key !== "totalLabaKotor" &&
          key !== "totalLabaBersih"
        ) {
          // Hanya field laba yang secara realistis mungkin negatif
          errors.push(`Nilai ${key} tidak boleh negatif.`);
        }

        // Jika tidak ada error untuk key ini, masukkan ke updates
        if (errors.length === 0) {
          updates[key] = data[key];
          updateFound = true;
        }
      }
    });

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    if (!updateFound) {
      errors.push("Tidak ada data valid yang dikirimkan untuk diperbarui.");
      return { valid: false, errors };
    }
    return { valid: true, updates };
  }
}

module.exports = { validateLaporanBulananPayload };
