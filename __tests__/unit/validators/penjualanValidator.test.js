const {
  validatePenjualanPayload,
} = require("../../../validators/penjualanValidator");
const mongoose = require("mongoose");

describe("Unit Test — Validator — Penjualan", () => {
  const validTenantID = new mongoose.Types.ObjectId().toString();
  const validPenggunaID = new mongoose.Types.ObjectId().toString();
  const validPelangganID = new mongoose.Types.ObjectId().toString();
  const validProdukID = new mongoose.Types.ObjectId().toString();
  const validDiskonID = new mongoose.Types.ObjectId().toString();
  const validPajakID = new mongoose.Types.ObjectId().toString();

  // Helper time: Sekarang - 1 menit lalu
  const pastDateStr = new Date(Date.now() - 60000).toISOString();
  // Helper time: Masa depan (Besok)
  const futureDateStr = new Date(Date.now() + 86400000).toISOString();

  const validCreatePayload = {
    tenantID: validTenantID,
    penggunaID: validPenggunaID,
    pelangganID: validPelangganID,
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: pastDateStr,
    itemPenjualan: [
      {
        produkID: validProdukID,
        jumlah: 2,
        hargaJual: 15000,
      },
    ],
  };

  describe("Aturan Global & Helper Functions", () => {
    test("Gagal jika simpanDraft atau finalize bukan boolean", () => {
      const res1 = validatePenjualanPayload(
        { ...validCreatePayload, simpanDraft: "ya" },
        false,
      );
      const res2 = validatePenjualanPayload({ finalize: "yes" }, true);

      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain("simpanDraft harus boolean");

      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain("finalize harus boolean");
    });

    test("Gagal jika statusPenjualan tidak valid (DRAFT/FINAL/VOID)", () => {
      const res = validatePenjualanPayload({
        ...validCreatePayload,
        statusPenjualan: "PENDING",
      });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain(
        "statusPenjualan tidak valid (DRAFT/FINAL/VOID)",
      );
    });

    test("Sukses memvalidasi array/single ID pada diskonGlobalIDs dan pajakTransaksiIDs", () => {
      // Test Array Valid
      const res1 = validatePenjualanPayload({
        ...validCreatePayload,
        diskonGlobalIDs: [validDiskonID],
        pajakTransaksiIDs: [validPajakID],
      });
      expect(res1.valid).toBe(true);

      // Test Single ID Valid
      const res2 = validatePenjualanPayload({
        ...validCreatePayload,
        diskonGlobalIDs: validDiskonID, // Bukan array, tapi fungsi mendukung single string
      });
      expect(res2.valid).toBe(true);

      // Test Invalid
      const res3 = validatePenjualanPayload({
        ...validCreatePayload,
        diskonGlobalIDs: ["invalid-id"],
        pajakTransaksiIDs: "invalid-pajak",
      });
      expect(res3.valid).toBe(false);
      expect(res3.errors).toContain(
        "diskonGlobalIDs mengandung ObjectId yang tidak valid",
      );
      expect(res3.errors).toContain("pajakTransaksiIDs tidak valid");
    });
  });

  describe("Mode Create (!isUpdate)", () => {
    test("Sukses (Valid) untuk payload dasar yang lengkap dan benar", () => {
      const result = validatePenjualanPayload(validCreatePayload);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("Gagal jika field root wajib kosong atau invalid format", () => {
      const result = validatePenjualanPayload({
        ...validCreatePayload,
        tenantID: "",
        penggunaID: "invalid-user",
        pelangganID: undefined,
        jenisTransaksi: "HUTANG", // tidak valid
        jenisPenjualan: "online", // tidak valid
        tanggalTransaksi: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tenantID wajib diisi dan valid");
      expect(result.errors).toContain("penggunaID wajib diisi dan valid");
      expect(result.errors).toContain("pelangganID wajib diisi dan valid");
      expect(result.errors).toContain(
        "jenisTransaksi wajib diisi dengan POS atau INVOICE",
      );
      expect(result.errors).toContain("tanggalTransaksi wajib diisi");
      expect(result.errors).toContain(
        "jenisPenjualan wajib diisi (dine-in/takeaway/booking)",
      );
    });

    test("Gagal jika tanggalTransaksi berada di masa depan (> 1 menit dari sekarang)", () => {
      const result = validatePenjualanPayload({
        ...validCreatePayload,
        tanggalTransaksi: futureDateStr,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Waktu transaksi penjualan tidak boleh di masa depan.",
      );
    });

    test("Gagal jika format tanggalTransaksi atau jatuhTempo tidak valid", () => {
      const result = validatePenjualanPayload({
        ...validCreatePayload,
        tanggalTransaksi: "waktu-ngawur",
        jatuhTempo: "besok-lusa",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tanggalTransaksi tidak valid");
      expect(result.errors).toContain("jatuhTempo tidak valid");
    });

    test("Gagal jika itemPenjualan kosong atau bukan array", () => {
      const res1 = validatePenjualanPayload({
        ...validCreatePayload,
        itemPenjualan: [],
      });
      const res2 = validatePenjualanPayload({
        ...validCreatePayload,
        itemPenjualan: "item-palsu",
      });

      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain(
        "itemPenjualan wajib diisi (minimal 1 produk)",
      );
      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain(
        "itemPenjualan wajib diisi (minimal 1 produk)",
      );
    });

    test("Gagal jika detail itemPenjualan tidak valid (ID, Jumlah, Harga, Diskon)", () => {
      const result = validatePenjualanPayload({
        ...validCreatePayload,
        itemPenjualan: [
          {
            produkID: "invalid-id",
            jumlah: 0, // harus >= 1
            hargaJual: -500, // harus >= 0
            jumlahDiskon: -100, // manual input harus >= 0
            diskonItemIDs: ["id-palsu"],
          },
        ],
        jumlahDiskonTransaksi: -50, // Test di level root juga
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Item #1: produkID tidak valid");
      expect(result.errors).toContain("Item #1: jumlah harus minimal 1");
      expect(result.errors).toContain("Item #1: hargaJual tidak boleh negatif");
      expect(result.errors).toContain(
        "Item #1: jumlahDiskon manual harus berupa angka dan tidak boleh negatif",
      );
      expect(result.errors).toContain(
        "Item #1: diskonItemIDs mengandung ObjectId yang tidak valid",
      );
      expect(result.errors).toContain(
        "jumlahDiskonTransaksi manual harus berupa angka dan tidak boleh negatif",
      );
    });
  });

  describe("Mode Update (isUpdate = true)", () => {
    test("Sukses (Valid) untuk payload update kosong (tidak ada yang diubah)", () => {
      const result = validatePenjualanPayload({}, true);
      expect(result.valid).toBe(true);
    });

    test("Sukses memvalidasi update parsial yang benar", () => {
      const result = validatePenjualanPayload(
        {
          pelangganID: validPelangganID,
          tanggalTransaksi: pastDateStr,
          itemPenjualan: [
            {
              produkID: validProdukID,
              jumlahDiskon: 5000,
              diskonItemIDs: [validDiskonID],
            },
          ],
        },
        true,
      );
      expect(result.valid).toBe(true);
    });

    test("Gagal jika payload update membawa data tidak valid", () => {
      const result = validatePenjualanPayload(
        {
          pelangganID: "invalid-pelanggan",
          tanggalTransaksi: futureDateStr, // Masa depan
          pajakTransaksiIDs: "invalid-pajak",
          diskonGlobalIDs: ["invalid-diskon"],
          jumlahDiskonTransaksi: "bukan-angka",
          itemPenjualan: [{ produkID: "invalid-produk", jumlahDiskon: -5 }],
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("pelangganID tidak valid");
      expect(result.errors).toContain(
        "Waktu transaksi penjualan tidak boleh di masa depan.",
      );
      expect(result.errors).toContain("pajakTransaksiIDs tidak valid");
      expect(result.errors).toContain(
        "diskonGlobalIDs mengandung ObjectId yang tidak valid",
      );
      expect(result.errors).toContain(
        "jumlahDiskonTransaksi manual harus berupa angka dan tidak boleh negatif",
      );
      expect(result.errors).toContain("Item #1: produkID tidak valid");
      expect(result.errors).toContain(
        "Item #1: jumlahDiskon manual harus berupa angka dan tidak boleh negatif",
      );
    });

    test("Gagal jika update mengirimkan array itemPenjualan kosong", () => {
      const result = validatePenjualanPayload({ itemPenjualan: [] }, true);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "itemPenjualan tidak boleh kosong jika dikirim",
      );
    });
  });
});
