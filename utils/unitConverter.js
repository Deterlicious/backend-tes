/**
 * Mengonversi nilai ke basis satuan terkecil (gram atau ml).
 * @param {number} value - Nilai asal
 * @param {string} unit - Satuan asal
 * @returns {number} - Nilai dalam gram/ml/pcs
 */
const toBaseUnit = (value, unit) => {
  const normalizedUnit = unit.toLowerCase();

  switch (normalizedUnit) {
    // Berat (Basis: gram)
    case "kg":
      return value * 1000;
    case "gram":
      return value;

    // Volume (Basis: ml)
    case "liter":
      return value * 1000;
    case "ml":
      return value;

    // Satuan Lain (Tidak dikonversi)
    case "pcs":
    case "pak":
    case "unit":
      return value;

    default:
      throw new Error(
        `Satuan '${unit}' tidak didukung untuk konversi otomatis.`
      );
  }
};

module.exports = { toBaseUnit };
