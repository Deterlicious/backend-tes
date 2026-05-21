const { validateRolePayload } = require("../../../validators/roleValidator");

describe("Unit Test Validator — Role", () => {
  test("Skenario 1 — Lolos validasi saat membuat role dengan payload lengkap dan valid", () => {
    const payload = {
      namaRole: "Admin",
      deskripsi: "Hak akses penuh tingkat toko",
      permissions: ["baca_laporan", "tulis_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test("Skenario 2 — Lolos validasi saat update role (Isian parsial diperbolehkan)", () => {
    const payload = {
      namaRole: "Manajer",
    };

    // Parameter kedua (isUpdate) = true
    const result = validateRolePayload(payload, true);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test("Skenario 3 — Gagal validasi jika payload bukan objek (null/undefined/string)", () => {
    const resultNull = validateRolePayload(null);
    expect(resultNull.valid).toBe(false);
    expect(resultNull.errors).toContain("Payload tidak valid");

    const resultString = validateRolePayload("payload_string");
    expect(resultString.valid).toBe(false);
  });

  test("Skenario 4 — Gagal validasi jika terdapat field ilegal (Typo / Injection Check)", () => {
    const payload = {
      namaRole: "Kasir",
      permissions: ["hapus_transaksi"],
      fieldHacker: true, // Ilegal
      roleId: "123", // Ilegal (harusnya tidak dikirim di body)
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]).toMatch(/Field 'fieldHacker' tidak dikenal/i);
    expect(result.errors[1]).toMatch(/Field 'roleId' tidak dikenal/i);
  });

  test("Skenario 5 — Gagal validasi [CREATE] jika namaRole kosong", () => {
    const payload = {
      namaRole: "",
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("namaRole wajib diisi");
  });

  test("Skenario 6 — Gagal validasi [CREATE] jika permissions bukan array atau kosong", () => {
    const payloadBukanArray = { namaRole: "Kasir", permissions: "baca_saja" };
    const result1 = validateRolePayload(payloadBukanArray, false);

    expect(result1.valid).toBe(false);
    expect(result1.errors).toContain(
      "permissions wajib berupa array dan tidak boleh kosong",
    );

    const payloadArrayKosong = { namaRole: "Kasir", permissions: [] };
    const result2 = validateRolePayload(payloadArrayKosong, false);

    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain(
      "permissions wajib memiliki minimal 1 item",
    );
  });

  test("Skenario 7 — Gagal validasi jika namaRole kurang dari 3 karakter", () => {
    const payload = {
      namaRole: "Ab",
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    // Perbaikan teks ekspektasi agar sesuai dengan pembaruan keamanan di validator
    expect(result.errors).toContain(
      "namaRole minimal 3 karakter (tidak termasuk spasi awal/akhir)",
    );
  });

  test("Skenario 8 — Gagal validasi jika namaRole lebih dari 50 karakter", () => {
    const payload = {
      namaRole: "A".repeat(51),
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("namaRole maksimal 50 karakter");
  });

  test("Skenario 9 — Gagal validasi jika isi array permissions tidak valid (bukan string/string kosong)", () => {
    const payload = {
      namaRole: "Staff",
      permissions: ["baca_laporan", 123, "   ", true],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    // Perbaikan teks ekspektasi agar sejalan dengan pembaruan keamanan terakhir
    expect(result.errors).toContain(
      "permissions mengandung format tidak valid atau item melebihi 100 karakter",
    );
  });

  test("Skenario 10 [EDGE CASE] — Gagal validasi jika namaRole hanya berisi spasi kosong (Whitespace Bypass)", () => {
    const payload = {
      namaRole: "     ", // 5 spasi
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "namaRole minimal 3 karakter (tidak termasuk spasi awal/akhir)",
    );
  });

  test("Skenario 11 [SECURITY] — Gagal validasi jika deskripsi dikirim dengan tipe data yang salah (Mencegah CastError)", () => {
    const payload = {
      namaRole: "Staff",
      deskripsi: { injeksi: true }, // Ilegal, harusnya string
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("deskripsi harus berupa teks");
  });

  test("Skenario 12 [SECURITY] — Gagal validasi jika deskripsi melebihi batas (Mencegah Database Bloating)", () => {
    const payload = {
      namaRole: "Staff",
      deskripsi: "A".repeat(256), // Melebihi 255 karakter
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("deskripsi maksimal 255 karakter");
  });

  test("Skenario 13 [SECURITY] — Gagal validasi jika namaRole dikirim dengan tipe data yang salah (Mencegah Type Confusion / Object Injection)", () => {
    const payload = {
      namaRole: { injeksi: true }, // Ilegal, harusnya string
      permissions: ["baca_laporan"],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("namaRole harus berupa teks");
  });

  test("Skenario 14 [EDGE CASE] — Gagal validasi jika payload utama adalah sebuah Array, bukan JSON Object murni", () => {
    const payload = [{ namaRole: "Admin", permissions: ["baca"] }];

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    // Payload berbentuk array akan ditangkap oleh Typo Check sebagai field ilegal (index 0)
    expect(result.errors[0]).toMatch(/Field '0' tidak dikenal/i);
  });

  test("Skenario 15 [SECURITY] — Gagal validasi jika jumlah permissions melebihi batas (Mencegah Array Bloating / DoS)", () => {
    const payload = {
      namaRole: "Admin",
      // Simulasi serangan payload raksasa (101 item)
      permissions: new Array(101).fill("baca_laporan"),
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("permissions maksimal 100 item");
  });

  test("Skenario 16 [SECURITY] — Gagal validasi jika teks di dalam array permissions terlalu panjang (Mencegah Vertical String Bloating)", () => {
    const payload = {
      namaRole: "Manajer",
      // Mengirim 1 item, tapi panjangnya 101 karakter
      permissions: ["A".repeat(101)],
    };

    const result = validateRolePayload(payload, false);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "permissions mengandung format tidak valid atau item melebihi 100 karakter",
    );
  });
});
