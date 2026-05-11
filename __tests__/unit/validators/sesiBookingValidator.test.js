const {
  validateSesiBookingPayload,
} = require("../../../validators/sesiBookingValidator");
const mongoose = require("mongoose");

describe("Unit Test — Validator — Sesi Booking", () => {
  // Generate valid ID and Dates untuk base payload
  const validTenantID = new mongoose.Types.ObjectId().toString();
  const validPengguna = new mongoose.Types.ObjectId().toString();
  const validPelanggan = new mongoose.Types.ObjectId().toString();
  const validAset = new mongoose.Types.ObjectId().toString();
  const validTarif = new mongoose.Types.ObjectId().toString();
  const validDiskon = new mongoose.Types.ObjectId().toString();

  const validMulai = "2026-05-11T10:00:00Z";
  const validSelesai = "2026-05-11T12:00:00Z"; // 2 jam setelah mulai

  const validCreatePayload = {
    tenantID: validTenantID,
    dataPengguna: validPengguna,
    dataPelanggan: validPelanggan,
    dataAset: validAset,
    waktuMulai: validMulai,
    waktuSelesai: validSelesai,
  };

  describe("Mode Create (!isUpdate)", () => {
    test("Sukses (Valid) untuk payload dasar yang lengkap dan benar", () => {
      const result = validateSesiBookingPayload(validCreatePayload);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("Sukses (Valid) dengan menyertakan semua optional fields yang valid", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        dataTarif: validTarif,
        diskonItem: [validDiskon],
        diskonGlobal: [validDiskon],
        status: "Selesai",
        simpanDraft: true,
        noReferensi: "REF/001",
      });
      expect(result.valid).toBe(true);
    });

    test("Gagal jika field wajib kosong", () => {
      const result = validateSesiBookingPayload({});

      expect(result.valid).toBe(false);
      const err = result.errors;
      expect(err).toContain("tenantID wajib diisi dan valid");
      expect(err).toContain("dataPengguna wajib diisi dan valid");
      expect(err).toContain("dataPelanggan wajib diisi dan valid");
      expect(err).toContain("dataAset wajib diisi dan valid");
      expect(err).toContain("waktuMulai wajib diisi");
      expect(err).toContain("waktuSelesai wajib diisi");
    });

    test("Gagal jika format ObjectId tidak valid", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        tenantID: "invalid-id",
        dataTarif: "invalid-tarif",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("tenantID wajib diisi dan valid");
      expect(result.errors).toContain("dataTarif tidak valid");
    });

    test("Gagal jika format Date (waktuMulai & waktuSelesai) tidak valid", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        waktuMulai: "bukan-tanggal",
        waktuSelesai: "waktu-ngasal",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Format waktuMulai tidak valid");
      expect(result.errors).toContain("Format waktuSelesai tidak valid");
    });

    test("Gagal jika field opsional array (diskonItem/diskonGlobal) bukan array atau isinya invalid", () => {
      const res1 = validateSesiBookingPayload({
        ...validCreatePayload,
        diskonItem: "bukan-array",
      });
      const res2 = validateSesiBookingPayload({
        ...validCreatePayload,
        diskonGlobal: ["invalid-id"],
      });

      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain("diskonItem harus berupa array ObjectId");

      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain(
        "diskonGlobal mengandung ObjectId yang tidak valid",
      );
    });

    test("Gagal jika tipe simpanDraft bukan boolean, noReferensi kosong, atau status di luar Enum", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        simpanDraft: "iya", // bukan boolean
        noReferensi: "   ", // string kosong
        status: "Pending", // tidak ada di VALID_STATUS
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("simpanDraft harus boolean");
      expect(result.errors).toContain(
        "noReferensi tidak boleh kosong jika dikirim",
      );
      expect(result.errors).toContain(
        "status tidak valid (Aktif/Selesai/Batal)",
      );
    });
  });

  describe("Mode Update (isUpdate = true)", () => {
    test("Sukses (Valid) untuk payload update kosong (tidak ada yang diubah)", () => {
      const result = validateSesiBookingPayload({}, true);
      expect(result.valid).toBe(true);
    });

    test("Gagal jika mencoba mengubah dataPenjualan (Terlarang/Proteksi Invoice)", () => {
      const result = validateSesiBookingPayload(
        { dataPenjualan: new mongoose.Types.ObjectId().toString() },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "dataPenjualan tidak boleh diubah melalui endpoint ini",
      );
    });

    test("Gagal jika update mengirimkan ObjectId, Date, Status atau Array yang invalid", () => {
      const result = validateSesiBookingPayload(
        {
          dataAset: "invalid-aset",
          waktuMulai: "tanggal-salah",
          status: "Gagal",
          diskonGlobal: "bukan-array",
        },
        true,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("dataAset tidak valid");
      expect(result.errors).toContain("Format waktuMulai tidak valid");
      expect(result.errors).toContain(
        "status tidak valid (Aktif/Selesai/Batal)",
      );
      expect(result.errors).toContain(
        "diskonGlobal harus berupa array ObjectId",
      );
    });
  });

  describe("Validasi Rentang Waktu (WaktuRange)", () => {
    test("Gagal jika waktuSelesai sama dengan atau lebih kecil dari waktuMulai (Mundur/Nol)", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        waktuMulai: validMulai,
        waktuSelesai: validMulai, // Sama persis
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "waktuSelesai harus lebih besar dari waktuMulai",
      );
    });

    test("Sukses (Valid) memasukkan tanggal ke masa lalu (karena batas 3 bulan sudah dihapus di validator ini)", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        waktuMulai: "2010-01-01T10:00:00Z",
        waktuSelesai: "2010-01-01T12:00:00Z", // Tanggal lampau sangat jauh tapi masuk akal (selesai > mulai)
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("Validasi Array 'items' (Multiple Sesi Booking / Cart)", () => {
    test("Sukses dengan array items yang valid", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        items: [
          {
            dataAset: validAset,
            waktuMulai: validMulai,
            waktuSelesai: validSelesai,
            dataTarif: validTarif,
            diskonItem: [validDiskon],
          },
        ],
      });

      expect(result.valid).toBe(true);
    });

    test("Gagal jika items bukan array atau merupakan array kosong", () => {
      const res1 = validateSesiBookingPayload({
        ...validCreatePayload,
        items: "bukan-array",
      });
      const res2 = validateSesiBookingPayload({
        ...validCreatePayload,
        items: [],
      });

      expect(res1.valid).toBe(false);
      expect(res1.errors).toContain(
        "items wajib berupa array dan tidak boleh kosong",
      );
      expect(res2.valid).toBe(false);
      expect(res2.errors).toContain(
        "items wajib berupa array dan tidak boleh kosong",
      );
    });

    test("Gagal jika items mengandung data yang invalid (Aset, Tanggal, Rentang, Tarif, Diskon)", () => {
      const result = validateSesiBookingPayload({
        ...validCreatePayload,
        items: [
          {
            // Item #1: Semua wajib kosong/invalid
            dataAset: "invalid-id",
            waktuMulai: "",
            waktuSelesai: "format-salah",
          },
          {
            // Item #2: Rentang waktu terbalik dan field opsional invalid
            dataAset: validAset,
            waktuMulai: validSelesai, // Terbalik
            waktuSelesai: validMulai,
            dataTarif: "invalid-tarif",
            diskonItem: "bukan-array",
          },
          {
            // Item #3: diskonItem valid array tapi isinya invalid
            dataAset: validAset,
            waktuMulai: validMulai,
            waktuSelesai: validSelesai,
            diskonItem: ["invalid-id"],
          },
        ],
      });

      expect(result.valid).toBe(false);
      const err = result.errors;

      // Error Item #1
      expect(err).toContain("Item #1: dataAset wajib diisi dan valid");
      expect(err).toContain("Item #1: waktuMulai wajib diisi");
      expect(err).toContain("Item #1: Format waktuSelesai tidak valid");

      // Error Item #2
      expect(err).toContain(
        "Item #2: waktuSelesai harus lebih besar dari waktuMulai",
      );
      expect(err).toContain("Item #2: dataTarif tidak valid");
      expect(err).toContain("Item #2: diskonItem harus berupa array");

      // Error Item #3
      expect(err).toContain(
        "Item #3: diskonItem mengandung ObjectId tidak valid",
      );
    });
  });
});
