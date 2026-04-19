const mongoose = require("mongoose");
const SesiBooking = require("../../../models/sesiBookingModel");

function createValidSesiBooking(overrides = {}) {
  return new SesiBooking({
    tenantID: new mongoose.Types.ObjectId(),
    dataPengguna: new mongoose.Types.ObjectId(),
    dataPelanggan: new mongoose.Types.ObjectId(),
    dataAset: new mongoose.Types.ObjectId(),
    dataPenjualan: new mongoose.Types.ObjectId(),
    dataTarif: new mongoose.Types.ObjectId(),
    waktuMulai: new Date("2026-04-01T10:00:00.000Z"),
    waktuSelesai: new Date("2026-04-01T11:30:00.000Z"),
    status: "Aktif",
    totalBiaya: 50000,
    ...overrides,
  });
}

async function runPreSave(doc) {
  if (!SesiBooking.schema.s.hooks) return;
  await new Promise((resolve, reject) => {
    SesiBooking.schema.s.hooks.execPre("save", doc, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

describe("SesiBooking Model Validation", () => {
  describe("field wajib", () => {
    test("gagal jika tenantID tidak diisi", async () => {
      const doc = createValidSesiBooking({ tenantID: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika dataPengguna tidak diisi", async () => {
      const doc = createValidSesiBooking({ dataPengguna: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika dataPelanggan tidak diisi", async () => {
      const doc = createValidSesiBooking({ dataPelanggan: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika dataAset tidak diisi", async () => {
      const doc = createValidSesiBooking({ dataAset: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika dataPenjualan tidak diisi", async () => {
      const doc = createValidSesiBooking({ dataPenjualan: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika waktuMulai tidak diisi", async () => {
      const doc = createValidSesiBooking({ waktuMulai: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika dataTarif tidak diisi", async () => {
      const doc = createValidSesiBooking({ dataTarif: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });
  });

  describe("enum dan nilai minimum", () => {
    test("gagal jika status bukan enum valid", async () => {
      const doc = createValidSesiBooking({ status: "BukanEnum" });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika totalBiaya negatif", async () => {
      const doc = createValidSesiBooking({ totalBiaya: -1000 });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika durasiMenit negatif", async () => {
      const doc = createValidSesiBooking({ durasiMenit: -5 });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("status Aktif valid", async () => {
      const doc = createValidSesiBooking({ status: "Aktif" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("status Selesai valid", async () => {
      const doc = createValidSesiBooking({ status: "Selesai" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("status Batal valid", async () => {
      const doc = createValidSesiBooking({ status: "Batal" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("status VOID valid", async () => {
      const doc = createValidSesiBooking({ status: "VOID" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });
  });

  describe("default value", () => {
    test("waktuSelesai default null", () => {
      const doc = new SesiBooking({ waktuMulai: new Date() });
      expect(doc.waktuSelesai).toBeNull();
    });

    test("durasiMenit default null", () => {
      const doc = new SesiBooking({ waktuMulai: new Date() });
      expect(doc.durasiMenit).toBeNull();
    });

    test("status default Aktif", async () => {
      const doc = createValidSesiBooking({ status: undefined });
      await doc.validate();
      expect(doc.status).toBe("Aktif");
    });

    test("totalBiaya default null", () => {
      const doc = new SesiBooking({});
      expect(doc.totalBiaya).toBeNull();
    });
  });

  describe("hook pre-save", () => {
    test("harus menghitung durasiMenit dari waktuMulai ke waktuSelesai", async () => {
      const doc = createValidSesiBooking({
        waktuMulai: new Date("2026-04-01T10:00:00.000Z"),
        waktuSelesai: new Date("2026-04-01T11:30:00.000Z"),
      });
      await runPreSave(doc);
      expect(doc.durasiMenit).toBe(90);
    });

    test("durasi dibulatkan ke atas", async () => {
      const doc = createValidSesiBooking({
        waktuMulai: new Date("2026-04-01T10:00:00.000Z"),
        waktuSelesai: new Date("2026-04-01T10:30:30.000Z"),
      });
      await runPreSave(doc);
      expect(doc.durasiMenit).toBe(31);
    });

    test("gagal jika waktuSelesai lebih awal dari waktuMulai", async () => {
      const doc = createValidSesiBooking({
        waktuMulai: new Date("2026-04-01T12:00:00.000Z"),
        waktuSelesai: new Date("2026-04-01T11:00:00.000Z"),
      });
      await expect(runPreSave(doc)).rejects.toThrow("Waktu selesai tidak boleh lebih awal dari waktu mulai.");
    });

    test("jika waktuSelesai null maka durasiMenit tetap null", async () => {
      const doc = createValidSesiBooking({
        waktuSelesai: null,
        durasiMenit: null,
      });
      await runPreSave(doc);
      expect(doc.durasiMenit).toBeNull();
    });
  });

  describe("Advanced Validation", () => {
    test("gagal jika totalBiaya diisi string bukan angka", async () => {
      const doc = createValidSesiBooking({ totalBiaya: "string-harga" });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika tenantID bukan format ObjectId", async () => {
      const doc = createValidSesiBooking({ tenantID: "123-bukan-id" });
      await expect(doc.validate()).rejects.toThrow();
    });
  });
});