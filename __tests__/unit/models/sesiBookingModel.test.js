const mongoose = require("mongoose");
const SesiBooking = require("../../../models/sesiBookingModel");

describe("Unit Test — Model — Sesi Booking", () => {
  const validData = {
    tenantID: new mongoose.Types.ObjectId(),
    dataPengguna: new mongoose.Types.ObjectId(),
    dataPelanggan: new mongoose.Types.ObjectId(),
    dataAset: new mongoose.Types.ObjectId(),
    dataPenjualan: new mongoose.Types.ObjectId(),
    dataTarif: new mongoose.Types.ObjectId(),
    waktuMulai: new Date("2026-05-11T10:00:00Z"),
  };

  describe("Konfigurasi Skema & Default Value", () => {
    test("Sukses membuat instance valid dan memastikan default value (Selesai, Durasi, Status, Biaya)", () => {
      const doc = new SesiBooking(validData);
      const err = doc.validateSync();

      expect(err).toBeUndefined(); // Lolos validasi Mongoose

      // Pengecekan nilai default
      expect(doc.waktuSelesai).toBeNull();
      expect(doc.durasiMenit).toBeNull();
      expect(doc.status).toBe("Aktif");
      expect(doc.totalBiaya).toBeNull();
    });

    test("Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar", () => {
      const schemaOptions = SesiBooking.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
      expect(schemaOptions.versionKey).toBe(false);
    });
  });

  describe("Validasi Field Wajib (Required) & Tipe Data", () => {
    test("Gagal validasi jika seluruh field wajib (ObjectId & Date) dikosongkan", () => {
      const doc = new SesiBooking({});
      const err = doc.validateSync();

      expect(err.errors.tenantID).toBeDefined();
      expect(err.errors.dataPengguna).toBeDefined();
      expect(err.errors.dataPelanggan).toBeDefined();
      expect(err.errors.dataAset).toBeDefined();
      expect(err.errors.dataPenjualan).toBeDefined();
      expect(err.errors.dataTarif).toBeDefined();
      expect(err.errors.waktuMulai).toBeDefined();
    });

    test("Gagal validasi jika field referensi diberikan nilai yang bukan ObjectId valid (CastError)", () => {
      const doc = new SesiBooking({
        ...validData,
        tenantID: "invalid-id",
        dataAset: "bukan-object-id",
      });

      const err = doc.validateSync();
      expect(err.errors.tenantID.name).toBe("CastError");
      expect(err.errors.dataAset.name).toBe("CastError");
    });
  });

  describe("Validasi Enum & Batasan Angka (Min)", () => {
    test("Gagal validasi jika status diisi nilai di luar Enum ('Aktif', 'Selesai', 'Batal')", () => {
      const doc = new SesiBooking({
        ...validData,
        status: "Pending", // Invalid
      });

      const err = doc.validateSync();
      expect(err.errors.status).toBeDefined();
      expect(err.errors.status.message).toMatch(/is not a valid enum value/i);
    });

    test("Gagal validasi jika durasiMenit atau totalBiaya bernilai negatif (kurang dari 0)", () => {
      const doc = new SesiBooking({
        ...validData,
        durasiMenit: -5, // Invalid min 0
        totalBiaya: -10000, // Invalid min 0
      });

      const err = doc.validateSync();
      expect(err.errors.durasiMenit).toBeDefined();
      expect(err.errors.totalBiaya).toBeDefined();
    });
  });

  describe("Logika Pre-Save Hook (Validasi Waktu & Kalkulasi Durasi)", () => {
    let preSaveHook;

    beforeAll(() => {
      // Dapatkan semua pre('save') hooks
      let hooks;
      if (SesiBooking.schema.s && SesiBooking.schema.s.hooks) {
        hooks = SesiBooking.schema.s.hooks._pres.get("save"); // Mongoose 6+
      } else {
        hooks = SesiBooking.schema._pres.get("save"); // Versi lama
      }

      // Cari spesifik hook buatan kita yang mengandung kata "durasiMenit"
      // untuk menghindari terpanggilnya hook internal Mongoose (spt validateBeforeSave)
      const targetHook = hooks.find((h) =>
        h.fn.toString().includes("durasiMenit"),
      );

      if (!targetHook) {
        throw new Error("Hook pre-save kustom tidak ditemukan!");
      }

      preSaveHook = targetHook.fn;
    });

    test("Hook langsung memanggil next() tanpa modifikasi jika waktuSelesai belum diisi (masih null/Aktif)", () => {
      const context = {
        waktuMulai: new Date("2026-05-11T10:00:00Z"),
        waktuSelesai: null,
      };
      const next = jest.fn();

      preSaveHook.call(context, next);

      expect(next).toHaveBeenCalledWith(); // Dipanggil tanpa argumen (tanpa error)
      expect(context.durasiMenit).toBeUndefined(); // Tidak dikalkulasi
    });

    test("Gagal (Melempar Error) jika waktuSelesai lebih awal dari waktuMulai (Mundur)", () => {
      const context = {
        waktuMulai: new Date("2026-05-11T12:00:00Z"),
        waktuSelesai: new Date("2026-05-11T10:00:00Z"), // Mundur 2 jam
      };
      const next = jest.fn();

      preSaveHook.call(context, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toMatch(
        /Waktu selesai tidak boleh lebih awal dari waktu mulai/i,
      );
    });

    test("Sukses menghitung dan membulatkan ke atas (Math.ceil) durasiMenit jika waktuSelesai dan waktuMulai valid", () => {
      const context = {
        waktuMulai: new Date("2026-05-11T10:00:00Z"), // 10:00:00
        waktuSelesai: new Date("2026-05-11T10:15:30Z"), // 10:15:30 (Selisih 15.5 menit)
      };
      const next = jest.fn();

      preSaveHook.call(context, next);

      expect(next).toHaveBeenCalledWith(); // Lolos tanpa error
      expect(context.durasiMenit).toBe(16); // 15.5 menit dibulatkan ke atas menjadi 16
    });

    test("Sukses menghitung durasiMenit secara akurat (Tepat bilangan bulat)", () => {
      const context = {
        waktuMulai: new Date("2026-05-11T10:00:00Z"),
        waktuSelesai: new Date("2026-05-11T11:00:00Z"), // Selisih tepat 60 menit
      };
      const next = jest.fn();

      preSaveHook.call(context, next);

      expect(next).toHaveBeenCalledWith();
      expect(context.durasiMenit).toBe(60);
    });
  });
});
