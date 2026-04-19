const mongoose = require("mongoose");
const Permission = require("../../../models/permissionModel");

/**
 * Helper untuk membuat instance Permission yang valid
 * Identik dengan pola createValidSesiBooking
 */
function createValidPermission(overrides = {}) {
  return new Permission({
    nama: "kelola-pengguna",
    grup: "Pengaturan",
    deskripsi: "Izin untuk mengelola data pengguna sistem",
    ...overrides,
  });
}

/**
 * Helper untuk menjalankan hook pre-save jika ada
 * (Walaupun saat ini belum ada hook, fungsi ini menjaga konsistensi pola test Anda)
 */
async function runPreSave(doc) {
  if (!Permission.schema.s.hooks) return;
  await new Promise((resolve, reject) => {
    Permission.schema.s.hooks.execPre("save", doc, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

describe("Permission Model Validation", () => {
  
  describe("field wajib", () => {
    test("gagal jika nama tidak diisi", async () => {
      const doc = createValidPermission({ nama: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("gagal jika grup tidak diisi", async () => {
      const doc = createValidPermission({ grup: undefined });
      await expect(doc.validate()).rejects.toThrow();
    });
  });

  describe("tipe data dan trimming", () => {
    test("harus melakukan trim pada field nama", async () => {
      const doc = createValidPermission({ nama: "   edit-produk   " });
      expect(doc.nama).toBe("edit-produk");
    });

    test("harus melakukan trim pada field grup", async () => {
      const doc = createValidPermission({ grup: "   Gudang   " });
      expect(doc.grup).toBe("Gudang");
    });
  });

  describe("default value", () => {
    test("deskripsi default null jika tidak diisi", () => {
      const doc = new Permission({ nama: "test", grup: "test" });
      expect(doc.deskripsi).toBeNull();
    });
  });

  describe("Advanced Validation", () => {
    test("gagal jika nama diisi object bukan string", async () => {
      const task = async () => {
        const doc = createValidPermission({ nama: { key: "value" } });
        await doc.validate();
      };
      // Menggunakan rejects.toThrow karena ini fungsi async
      await expect(task()).rejects.toThrow();
    });

    test("gagal jika grup diisi array", async () => {
      const task = async () => {
        const doc = createValidPermission({ grup: ["Grup1", "Grup2"] });
        await doc.validate();
      };
      await expect(task()).rejects.toThrow();
    });

    test("harus menolak field tambahan yang tidak ada di schema (Strict Mode)", () => {
      const doc = new Permission({
        nama: "test",
        grup: "test",
        fieldIlegal: "ini tidak boleh ada"
      });
      // Mongoose secara default mengabaikan field yang tidak didefinisikan di schema
      expect(doc.fieldIlegal).toBeUndefined();
    });
  });

  describe("integritas skema", () => {
    test("berhasil jika deskripsi diisi string panjang", async () => {
      const longDesc = "a".repeat(500);
      const doc = createValidPermission({ deskripsi: longDesc });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("gagal jika nama diisi string kosong setelah trim", async () => {
      const doc = createValidPermission({ nama: "    " });
      await expect(doc.validate()).rejects.toThrow();
    });
  });

});