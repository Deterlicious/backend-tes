const {
  toBaseUnit,
  convertToBaseUnit,
  getAvailableUnits,
} = require("../../../utils/unitConverter");

// ─────────────────────────────────────────────────────────────────────────────
// CATATAN KONSEP
// Tiga fungsi di unitConverter memiliki tujuan berbeda:
//
// 1. toBaseUnit(value, unit)
//    → Konversi ke satuan ABSOLUT terkecil (gram atau ml)
//    → Dipakai oleh sistem lama / logika internal
//    → Throw Error jika satuan tidak dikenal
//
// 2. convertToBaseUnit(value, fromUnit, baseUnit)
//    → Konversi RELATIF — dari satuan user ke satuan base BahanBaku
//    → Tidak throw, fallback return value jika pasangan tidak dikenal
//    → Ini yang dipakai service untuk simpan ke DB
//
// 3. getAvailableUnits(baseSatuan)
//    → Return array satuan yang boleh dipilih user di dropdown
//    → Aturan: hanya bisa ke bawah (kg bisa dipilih gram, bukan sebaliknya)
// ─────────────────────────────────────────────────────────────────────────────

describe("unitConverter — Unit Test", () => {

  // ══════════════════════════════════════════════════════════════════════════
  // FUNGSI 1: toBaseUnit(value, unit)
  // ══════════════════════════════════════════════════════════════════════════
  describe("toBaseUnit — Konversi ke Satuan Absolut Terkecil", () => {

    // ── A: Happy Path ───────────────────────────────────────────────────────
    describe("A: Happy Path — Satuan yang Didukung", () => {

      test("A1: kg → gram | 1 kg = 1000 gram", () => {
        expect(toBaseUnit(1, "kg")).toBe(1000);
      });

      test("A2: kg → gram | 2.5 kg = 2500 gram", () => {
        expect(toBaseUnit(2.5, "kg")).toBe(2500);
      });

      test("A3: gram → gram | nilai tidak berubah (no-op)", () => {
        expect(toBaseUnit(500, "gram")).toBe(500);
      });

      test("A4: liter → ml | 1 liter = 1000 ml", () => {
        expect(toBaseUnit(1, "liter")).toBe(1000);
      });

      test("A5: liter → ml | 0.5 liter = 500 ml", () => {
        expect(toBaseUnit(0.5, "liter")).toBe(500);
      });

      test("A6: ml → ml | nilai tidak berubah (no-op)", () => {
        expect(toBaseUnit(200, "ml")).toBe(200);
      });

      test("A7: pcs → pcs | tidak dikonversi", () => {
        expect(toBaseUnit(10, "pcs")).toBe(10);
      });

      test("A8: pak → pak | tidak dikonversi", () => {
        expect(toBaseUnit(3, "pak")).toBe(3);
      });

      test("A9: unit → unit | tidak dikonversi", () => {
        expect(toBaseUnit(5, "unit")).toBe(5);
      });

    });

    // ── B: Case Insensitive ─────────────────────────────────────────────────
    describe("B: Case Insensitive", () => {

      test("B1: 'KG' (uppercase) harus dikenali sama dengan 'kg'", () => {
        expect(toBaseUnit(1, "KG")).toBe(1000);
      });

      test("B2: 'Gram' (mixed case) harus dikenali", () => {
        expect(toBaseUnit(500, "Gram")).toBe(500);
      });

      test("B3: 'LITER' (uppercase) harus dikenali", () => {
        expect(toBaseUnit(1, "LITER")).toBe(1000);
      });

      test("B4: 'ML' (uppercase) harus dikenali", () => {
        expect(toBaseUnit(200, "ML")).toBe(200);
      });

    });

    // ── C: Error pada Satuan Tidak Dikenal ──────────────────────────────────
    describe("C: Throw Error — Satuan Tidak Dikenal", () => {

      test("C1: satuan 'ons' tidak didukung — harus throw Error", () => {
        expect(() => toBaseUnit(100, "ons")).toThrow();
      });

      test("C2: satuan 'ton' tidak didukung — harus throw Error", () => {
        expect(() => toBaseUnit(1, "ton")).toThrow();
      });

      test("C3: satuan string kosong '' — harus throw Error", () => {
        expect(() => toBaseUnit(1, "")).toThrow();
      });

      test("C4: pesan error menyebut satuan yang tidak dikenali", () => {
        expect(() => toBaseUnit(1, "ons")).toThrow(/ons/);
      });

    });

    // ── D: Edge Values ──────────────────────────────────────────────────────
    describe("D: Edge Values", () => {

      test("D1: value = 0 → tetap 0 (0 kg = 0 gram)", () => {
        expect(toBaseUnit(0, "kg")).toBe(0);
      });

      test("D2: value desimal kecil | 0.001 kg = 1 gram", () => {
        expect(toBaseUnit(0.001, "kg")).toBeCloseTo(1, 5);
      });

      test("D3: value sangat besar | 1.000.000 gram = 1.000.000", () => {
        expect(toBaseUnit(1_000_000, "gram")).toBe(1_000_000);
      });

      test("D4: value negatif diterima — validasi batas bawah bukan tanggung jawab utils", () => {
        // toBaseUnit hanya mengonversi, tidak memvalidasi apakah nilai masuk akal
        expect(toBaseUnit(-5, "kg")).toBe(-5000);
      });

    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // FUNGSI 2: convertToBaseUnit(value, fromUnit, baseUnit)
  // ══════════════════════════════════════════════════════════════════════════
  describe("convertToBaseUnit — Konversi Relatif ke Satuan Base BahanBaku", () => {

    // ── A: Same Unit = No-Op ────────────────────────────────────────────────
    describe("A: Satuan Sama — Tidak Perlu Konversi", () => {

      test("A1: gram → gram | nilai tidak berubah", () => {
        expect(convertToBaseUnit(500, "gram", "gram")).toBe(500);
      });

      test("A2: kg → kg | nilai tidak berubah", () => {
        expect(convertToBaseUnit(2, "kg", "kg")).toBe(2);
      });

      test("A3: liter → liter | nilai tidak berubah", () => {
        expect(convertToBaseUnit(1.5, "liter", "liter")).toBe(1.5);
      });

      test("A4: ml → ml | nilai tidak berubah", () => {
        expect(convertToBaseUnit(300, "ml", "ml")).toBe(300);
      });

      test("A5: pcs → pcs | nilai tidak berubah", () => {
        expect(convertToBaseUnit(10, "pcs", "pcs")).toBe(10);
      });

    });

    // ── B: Konversi Berat ───────────────────────────────────────────────────
    describe("B: Konversi Berat (gram ↔ kg)", () => {

      test("B1: 500 gram → kg = 0.5", () => {
        expect(convertToBaseUnit(500, "gram", "kg")).toBe(0.5);
      });

      test("B2: 1000 gram → kg = 1", () => {
        expect(convertToBaseUnit(1000, "gram", "kg")).toBe(1);
      });

      test("B3: 1 gram → kg = 0.001", () => {
        expect(convertToBaseUnit(1, "gram", "kg")).toBe(0.001);
      });

      test("B4: 250 gram → kg = 0.25", () => {
        expect(convertToBaseUnit(250, "gram", "kg")).toBe(0.25);
      });

      test("B5: 0.5 kg → gram = 500", () => {
        expect(convertToBaseUnit(0.5, "kg", "gram")).toBe(500);
      });

      test("B6: 1 kg → gram = 1000", () => {
        expect(convertToBaseUnit(1, "kg", "gram")).toBe(1000);
      });

      test("B7: 2.5 kg → gram = 2500", () => {
        expect(convertToBaseUnit(2.5, "kg", "gram")).toBe(2500);
      });

    });

    // ── C: Konversi Volume ──────────────────────────────────────────────────
    describe("C: Konversi Volume (ml ↔ liter)", () => {

      test("C1: 200 ml → liter = 0.2", () => {
        expect(convertToBaseUnit(200, "ml", "liter")).toBe(0.2);
      });

      test("C2: 1000 ml → liter = 1", () => {
        expect(convertToBaseUnit(1000, "ml", "liter")).toBe(1);
      });

      test("C3: 1 ml → liter = 0.001", () => {
        expect(convertToBaseUnit(1, "ml", "liter")).toBe(0.001);
      });

      test("C4: 0.5 liter → ml = 500", () => {
        expect(convertToBaseUnit(0.5, "liter", "ml")).toBe(500);
      });

      test("C5: 1 liter → ml = 1000", () => {
        expect(convertToBaseUnit(1, "liter", "ml")).toBe(1000);
      });

    });

    // ── D: Pasangan Satuan Tidak Dikenal (Fallback) ─────────────────────────
    describe("D: Fallback — Pasangan Satuan Tidak Dikenal", () => {

      test("D1: gram → liter (lintas jenis) → fallback, nilai dikembalikan apa adanya", () => {
        // gram dan liter beda jenis (berat vs volume) — tidak ada di rates table
        expect(convertToBaseUnit(500, "gram", "liter")).toBe(500);
      });

      test("D2: pcs → kg (tidak ada konversi) → fallback", () => {
        expect(convertToBaseUnit(10, "pcs", "kg")).toBe(10);
      });

      test("D3: pak → liter (tidak ada konversi) → fallback", () => {
        expect(convertToBaseUnit(5, "pak", "liter")).toBe(5);
      });

      test("D4: satuan tidak dikenal sama sekali → fallback, tidak throw", () => {
        // convertToBaseUnit tidak throw — berbeda dengan toBaseUnit
        expect(() => convertToBaseUnit(100, "ons", "kg")).not.toThrow();
        expect(convertToBaseUnit(100, "ons", "kg")).toBe(100);
      });

    });

    // ── E: Case Insensitive ─────────────────────────────────────────────────
    describe("E: Case Insensitive", () => {

      test("E1: 'GRAM' → 'KG' harus dikenali sama dengan 'gram' → 'kg'", () => {
        expect(convertToBaseUnit(500, "GRAM", "KG")).toBe(0.5);
      });

      test("E2: 'Gram' → 'Kg' (mixed case) harus dikenali", () => {
        expect(convertToBaseUnit(500, "Gram", "Kg")).toBe(0.5);
      });

      test("E3: 'ML' → 'LITER' harus dikenali", () => {
        expect(convertToBaseUnit(200, "ML", "LITER")).toBe(0.2);
      });

      test("E4: satuan sama tapi beda case ('KG' vs 'kg') → tetap no-op", () => {
        expect(convertToBaseUnit(2, "KG", "kg")).toBe(2);
      });

    });

    // ── F: Edge Values ──────────────────────────────────────────────────────
    describe("F: Edge Values", () => {

      test("F1: value = 0 | 0 gram → kg = 0", () => {
        expect(convertToBaseUnit(0, "gram", "kg")).toBe(0);
      });

      test("F2: value sangat kecil | 0.001 gram → kg = 0.000001", () => {
        expect(convertToBaseUnit(0.001, "gram", "kg")).toBeCloseTo(0.000001, 10);
      });

      test("F3: value sangat besar | 1.000.000 gram → kg = 1000", () => {
        expect(convertToBaseUnit(1_000_000, "gram", "kg")).toBe(1000);
      });

      test("F4: konversi balik akurat | 500 gram → kg → gram kembali ke 500", () => {
        const inKg = convertToBaseUnit(500, "gram", "kg");   // 0.5
        const backToGram = convertToBaseUnit(inKg, "kg", "gram"); // 500
        expect(backToGram).toBeCloseTo(500, 5);
      });

      test("F5: konversi balik volume | 200 ml → liter → ml kembali ke 200", () => {
        const inLiter = convertToBaseUnit(200, "ml", "liter");  // 0.2
        const backToMl = convertToBaseUnit(inLiter, "liter", "ml"); // 200
        expect(backToMl).toBeCloseTo(200, 5);
      });

    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // FUNGSI 3: getAvailableUnits(baseSatuan)
  // ══════════════════════════════════════════════════════════════════════════
  describe("getAvailableUnits — Daftar Satuan yang Bisa Dipilih User", () => {

    // ── A: Satuan Base yang Didukung ────────────────────────────────────────
    describe("A: Happy Path — Satuan Base Dikenal", () => {

      test("A1: base 'kg' → ['kg', 'gram']", () => {
        expect(getAvailableUnits("kg")).toEqual(["kg", "gram"]);
      });

      test("A2: base 'gram' → ['gram'] saja (tidak ada satuan lebih kecil)", () => {
        expect(getAvailableUnits("gram")).toEqual(["gram"]);
      });

      test("A3: base 'liter' → ['liter', 'ml']", () => {
        expect(getAvailableUnits("liter")).toEqual(["liter", "ml"]);
      });

      test("A4: base 'ml' → ['ml'] saja (tidak ada satuan lebih kecil)", () => {
        expect(getAvailableUnits("ml")).toEqual(["ml"]);
      });

    });

    // ── B: Satuan Lain (Fallback) ───────────────────────────────────────────
    describe("B: Fallback — Satuan Tidak Dikenal", () => {

      test("B1: base 'pcs' → ['pcs'] (tidak ada konversi relevan)", () => {
        expect(getAvailableUnits("pcs")).toEqual(["pcs"]);
      });

      test("B2: base 'pak' → ['pak']", () => {
        expect(getAvailableUnits("pak")).toEqual(["pak"]);
      });

      test("B3: base 'unit' → ['unit']", () => {
        expect(getAvailableUnits("unit")).toEqual(["unit"]);
      });

      test("B4: base satuan custom ('porsi') → ['porsi'] — fallback aman, tidak throw", () => {
        expect(() => getAvailableUnits("porsi")).not.toThrow();
        expect(getAvailableUnits("porsi")).toEqual(["porsi"]);
      });

    });

    // ── C: Case Insensitive ─────────────────────────────────────────────────
    describe("C: Case Insensitive", () => {

      test("C1: 'KG' uppercase → sama dengan 'kg', return ['kg', 'gram']", () => {
        expect(getAvailableUnits("KG")).toEqual(["kg", "gram"]);
      });

      test("C2: 'GRAM' uppercase → return ['gram']", () => {
        expect(getAvailableUnits("GRAM")).toEqual(["gram"]);
      });

      test("C3: 'Liter' mixed case → return ['liter', 'ml']", () => {
        expect(getAvailableUnits("Liter")).toEqual(["liter", "ml"]);
      });

      test("C4: 'ML' uppercase → return ['ml']", () => {
        expect(getAvailableUnits("ML")).toEqual(["ml"]);
      });

    });

    // ── D: Return Type & Struktur ───────────────────────────────────────────
    describe("D: Garansi Tipe Return", () => {

      test("D1: selalu return Array untuk semua input", () => {
        ["kg", "gram", "liter", "ml", "pcs", "pak", "unit", "porsi"].forEach((s) => {
          expect(Array.isArray(getAvailableUnits(s))).toBe(true);
        });
      });

      test("D2: array tidak pernah kosong", () => {
        ["kg", "gram", "liter", "ml", "pcs", "porsi"].forEach((s) => {
          expect(getAvailableUnits(s).length).toBeGreaterThan(0);
        });
      });

      test("D3: elemen pertama selalu versi lowercase dari input (aturan 'base selalu tersedia')", () => {
        // User harus selalu bisa memilih satuan base itu sendiri
        expect(getAvailableUnits("kg")[0]).toBe("kg");
        expect(getAvailableUnits("liter")[0]).toBe("liter");
        expect(getAvailableUnits("gram")[0]).toBe("gram");
        expect(getAvailableUnits("ml")[0]).toBe("ml");
      });

      test("D4: 'gram' tidak muncul di result 'ml' — beda jenis tidak bercampur", () => {
        expect(getAvailableUnits("ml")).not.toContain("gram");
      });

      test("D5: 'liter' tidak muncul di result 'kg'", () => {
        expect(getAvailableUnits("kg")).not.toContain("liter");
      });

    });

    // ── E: Konsistensi dengan convertToBaseUnit ─────────────────────────────
    describe("E: Konsistensi Antar Fungsi", () => {

      test("E1: semua unit dalam getAvailableUnits('kg') bisa dikonversi oleh convertToBaseUnit", () => {
        // Setiap unit yang ditawarkan ke user harus bisa diproses oleh converter
        const units = getAvailableUnits("kg"); // ["kg", "gram"]
        units.forEach((unit) => {
          expect(() => convertToBaseUnit(1, unit, "kg")).not.toThrow();
          expect(typeof convertToBaseUnit(1, unit, "kg")).toBe("number");
        });
      });

      test("E2: semua unit dalam getAvailableUnits('liter') bisa dikonversi ke liter", () => {
        const units = getAvailableUnits("liter"); // ["liter", "ml"]
        units.forEach((unit) => {
          expect(() => convertToBaseUnit(1, unit, "liter")).not.toThrow();
        });
      });

      test("E3: skenario realistis — user pilih 'gram', base 'kg', konversi harus benar", () => {
        const baseUnit = "kg";
        const availableUnits = getAvailableUnits(baseUnit); // ["kg", "gram"]

        expect(availableUnits).toContain("gram"); // gram memang tersedia

        const result = convertToBaseUnit(500, "gram", baseUnit);
        expect(result).toBe(0.5); // 500 gram = 0.5 kg
      });

    });

  });

});
