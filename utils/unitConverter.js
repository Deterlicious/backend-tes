/**
 * Mengonversi nilai ke basis satuan terkecil (gram atau ml).
 * Dipakai oleh sistem lama / logika internal lainnya.
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

/**
 * Mengonversi nilai dari satuan yang dipilih user ke satuan base BahanBaku.
 *
 * Konsep: BahanBaku di database disimpan dalam "satuan base" (misal: kg, liter).
 * User boleh input dalam satuan lebih kecil (misal: gram, ml).
 * Fungsi ini menjembatani keduanya agar angka yang masuk ke DB selalu konsisten.
 *
 * Contoh:
 *   convertToBaseUnit(500, "gram", "kg")   → 0.5   (500 gram = 0.5 kg)
 *   convertToBaseUnit(200, "ml",   "liter") → 0.2   (200 ml   = 0.2 liter)
 *   convertToBaseUnit(2,   "kg",   "kg")   → 2     (sama, tidak perlu konversi)
 *
 * @param {number} value    - Nilai yang diinput user
 * @param {string} fromUnit - Satuan yang dipilih user (misal: "gram")
 * @param {string} baseUnit - Satuan base BahanBaku di master data (misal: "kg")
 * @returns {number} - Nilai dalam satuan base, siap disimpan ke DB
 */
const convertToBaseUnit = (value, fromUnit, baseUnit) => {
  // Jika satuan sama, tidak perlu konversi
  if (fromUnit.toLowerCase() === baseUnit.toLowerCase()) return value;

  const key = `${fromUnit.toLowerCase()}_to_${baseUnit.toLowerCase()}`;

  // Tabel faktor konversi antar satuan
  const rates = {
    gram_to_kg: 0.001,   // 1 gram  = 0.001 kg
    kg_to_gram: 1000,    // 1 kg    = 1000 gram
    ml_to_liter: 0.001,  // 1 ml    = 0.001 liter
    liter_to_ml: 1000,   // 1 liter = 1000 ml
  };

  if (rates[key] !== undefined) {
    return value * rates[key];
  }

  // Jika satuan tidak dikenal (misal: pcs, pak, unit), kembalikan nilai apa adanya
  return value;
};

/**
 * Mengembalikan daftar satuan yang boleh dipilih user berdasarkan satuan base BahanBaku.
 *
 * Konsep: Aturan "hanya bisa ke bawah" — user tidak boleh memilih satuan
 * yang lebih besar dari base. Jika base-nya "gram", user tidak boleh pilih "kg"
 * karena itu berarti input lebih besar dari satuan base (ambigu).
 *
 * Contoh:
 *   getAvailableUnits("kg")    → ["kg", "gram"]  (boleh input dalam kg atau gram)
 *   getAvailableUnits("gram")  → ["gram"]         (hanya gram, tidak ada yang lebih kecil)
 *   getAvailableUnits("liter") → ["liter", "ml"]
 *   getAvailableUnits("pcs")   → ["pcs"]
 *
 * @param {string} baseSatuan - Satuan base dari master data BahanBaku
 * @returns {string[]} - Array satuan yang bisa dipilih di dropdown Frontend
 */
const getAvailableUnits = (baseSatuan) => {
  switch (baseSatuan.toLowerCase()) {
    case "kg":
      return ["kg", "gram"];
    case "gram":
      return ["gram"];
    case "liter":
      return ["liter", "ml"];
    case "ml":
      return ["ml"];
    default:
      // Untuk pcs, pak, unit — tidak ada konversi yang relevan
      return [baseSatuan];
  }
};

module.exports = { toBaseUnit, convertToBaseUnit, getAvailableUnits };
