const mongoose = require("mongoose");
const createError = require("http-errors"); // Diimpor tapi tidak digunakan di validator ini

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * * @param {object} data - req.body atau data update.
 * @param {boolean} isUpdate - Flag untuk menandakan apakah ini operasi update.
 * @returns {object} { valid: boolean, updates?: object, errors?: string[] }
 */
function validateLaporanHarianPayload(data, isUpdate = false) {
  const errors = [];
  const updates = {};

  // Fields yang diizinkan untuk di-CREATE/di-UPDATE (termasuk field perhitungan)
  const allowedFields = [
    "laporanHarianID",
    "tenantID",
    "tanggal",
    "jumlahTransaksi",
    "totalPenjualanKotor",
    "totalDiskon",
    "totalOmzet",
    "totalHPP",
    "totalLabaKotor",
    "totalBebanOperasional",
    "totalLabaBersih",
    "totalUangMasuk",
    "totalUangKeluar",
  ];

  // --- Validasi Mandatory Fields (CREATE) ---
  if (!isUpdate) {
    // Field Kritis yang wajib ada saat CREATE (minimal ID, Tenant, dan Tanggal)
    if (!data.laporanHarianID || !data.tenantID || !data.tanggal) {
      errors.push("laporanHarianID, tenantID, dan tanggal wajib diisi.");
    }

    // Pengecekan Format ID untuk CREATE
    if (data.tenantID && !isValidObjectId(data.tenantID)) {
      errors.push("Format ID Tenant tidak valid.");
    }

    // Pengecekan Tipe Dasar
    if (data.tanggal && isNaN(new Date(data.tanggal))) {
      errors.push("Format Tanggal Laporan tidak valid.");
    }

    if (errors.length > 0) return { valid: false, errors };

    // Whitelisting data CREATE agar hanya field yang diperbolehkan yang masuk
    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = data[key];
      }
    });

    // Jika CREATE, kembalikan data yang sudah di-whitelisted
    return { valid: true, updates };
  }

  // --- Whitelisting dan Pengecekan Data UPDATE ---
  if (isUpdate) {
    let updateFound = false;
    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key)) {
        // Pengecekan Tipe Dasar saat Update
        if (key === "tenantID" && !isValidObjectId(data[key])) {
          errors.push("Format ID Tenant tidak valid.");
        } else if (key === "tanggal" && isNaN(new Date(data[key]))) {
          errors.push("Format Tanggal Laporan tidak valid.");
        } else if (
          typeof data[key] === "number" &&
          data[key] < 0 &&
          key !== "totalLabaKotor" &&
          key !== "totalLabaBersih"
        ) {
          // Hanya field laba yang boleh bernilai negatif
          errors.push(`Nilai ${key} tidak boleh negatif.`);
        }

        // Jika tidak ada error, masukkan ke updates
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

module.exports = { validateLaporanHarianPayload };
