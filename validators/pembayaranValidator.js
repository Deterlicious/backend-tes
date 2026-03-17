const mongoose = require("mongoose");

const VALID_STATUS = ["PAID", "PENDING", "EXPIRED", "FAILED"];
const INDONESIA_OFFSET_MINUTES = 7 * 60;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function toYMDIndonesia(dateObj) {
  const shifted = new Date(
    dateObj.getTime() + INDONESIA_OFFSET_MINUTES * 60 * 1000
  );

  return shifted.toISOString().slice(0, 10);
}

function getIndonesiaNowShifted() {
  return new Date(Date.now() + INDONESIA_OFFSET_MINUTES * 60 * 1000);
}

function getMinYMDIndonesiaFor3MonthsWindow() {
  const nowShifted = getIndonesiaNowShifted();
  const year = nowShifted.getUTCFullYear();
  const month = nowShifted.getUTCMonth();
  const minShiftedUTC = new Date(Date.UTC(year, month - 3, 1));

  return minShiftedUTC.toISOString().slice(0, 10);
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return NaN;
  if (typeof value === "number") return value;

  return parseFloat(String(value).trim());
}

function validatePembayaranPayload(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    if (!data.tenantID || !isValidObjectId(data.tenantID)) {
      errors.push("tenantID wajib diisi dan valid");
    }

    if (!data.penjualanID || !isValidObjectId(data.penjualanID)) {
      errors.push("penjualanID wajib diisi dan valid");
    }

    if (!data.metodePembayaranID || !isValidObjectId(data.metodePembayaranID)) {
      errors.push("metodePembayaranID wajib diisi dan valid");
    }

    if (!data.akunKasID || !isValidObjectId(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }

    const n = toNumber(data.jumlahBayar);

    if (!Number.isFinite(n) || n < 0) {
      errors.push("jumlahBayar wajib diisi dan tidak boleh negatif");
    }
  }

  if (isUpdate && data.jumlahBayar !== undefined) {
    const n = toNumber(data.jumlahBayar);

    if (!Number.isFinite(n) || n < 0) {
      errors.push(
        "jumlahBayar tidak valid (harus angka dan tidak boleh negatif)"
      );
    }
  }

  if (data.akunKasID !== undefined) {
    if (!data.akunKasID || !isValidObjectId(data.akunKasID)) {
      errors.push("akunKasID wajib diisi dan valid");
    }
  }

  if (data.status && !VALID_STATUS.includes(data.status)) {
    errors.push(`Status tidak valid. Pilihan: ${VALID_STATUS.join(", ")}`);
  }

  if (Object.prototype.hasOwnProperty.call(data, "tanggalBayar")) {
    if (data.tanggalBayar === "" || data.tanggalBayar === null) {
      errors.push("Format tanggal bayar tidak valid.");
    } else if (data.tanggalBayar) {
      const inputDate = new Date(data.tanggalBayar);

      if (Number.isNaN(inputDate.getTime())) {
        errors.push("Format tanggal bayar tidak valid.");
      } else {
        const inputYMD = toYMDIndonesia(inputDate);
        const nowYMD = toYMDIndonesia(new Date());
        const minYMD = getMinYMDIndonesiaFor3MonthsWindow();

        if (inputYMD > nowYMD) {
          errors.push("Tanggal pembayaran tidak boleh di masa depan.");
        }

        if (inputYMD < minYMD) {
          errors.push(
            "Tanggal pembayaran tidak boleh lebih lama dari batas 3 bulan (berdasarkan awal bulan)."
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validatePembayaranPayload };