const validator = require("validator");
const mongoose = require("mongoose");

const VALID_TIPE = ["Bulanan", "Harian", "Per-jam"];
const VALID_STATUS = ["Aktif", "Berakhir"];
const VALID_JENIS = ["Tetap", "Kontrak"];

function validateKontrakPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.penggunaID || !mongoose.Types.ObjectId.isValid(data.penggunaID)) {
      errors.push("penggunaID wajib diisi dan valid");
    }

    if (!data.jenisKontrak || !VALID_JENIS.includes(data.jenisKontrak)) {
      errors.push(`jenisKontrak tidak valid. Pilih: ${VALID_JENIS.join(", ")}`);
    }

    // --- LOGIKA BARU SESUAI PERMINTAAN ANDA ---
    if (data.jenisKontrak === "Kontrak" && !data.tanggalSelesai) {
      errors.push("tanggalSelesai wajib diisi untuk jenis 'Kontrak'");
    }

    // Jika pegawai Tetap, dan admin malah mengirimkan tanggalSelesai, tolak!
    if (data.jenisKontrak === "Tetap" && data.tanggalSelesai) {
      errors.push(
        "tanggalSelesai tidak boleh diisi saat membuat kontrak jenis 'Tetap'",
      );
    }
    // ------------------------------------------

    if (!data.tipeGaji || !VALID_TIPE.includes(data.tipeGaji)) {
      errors.push(`Tipe gaji tidak valid. Pilih: ${VALID_TIPE.join(", ")}`);
    }

    if (data.tarifGaji === undefined || data.tarifGaji < 0) {
      errors.push("tarifGaji wajib diisi dan harus angka positif");
    }

    if (!data.tanggalMulai) {
      errors.push("tanggalMulai wajib diisi");
    }
  }

  // Validasi saat Update
  if (data.jenisKontrak && !VALID_JENIS.includes(data.jenisKontrak)) {
    errors.push(`jenisKontrak tidak valid. Pilih: ${VALID_JENIS.join(", ")}`);
  }

  if (data.tipeGaji && !VALID_TIPE.includes(data.tipeGaji)) {
    errors.push(`Tipe gaji tidak valid. Pilih: ${VALID_TIPE.join(", ")}`);
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push(`Status tidak valid. Pilih: ${VALID_STATUS.join(", ")}`);
  }

  if (data.tarifGaji !== undefined && data.tarifGaji < 0) {
    errors.push("tarifGaji tidak boleh negatif");
  }

  if (data.tanggalMulai && data.tanggalSelesai) {
    const start = new Date(data.tanggalMulai);
    const end = new Date(data.tanggalSelesai);
    if (end < start) {
      errors.push("tanggalSelesai tidak boleh sebelum tanggalMulai");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateKontrakPayload };
