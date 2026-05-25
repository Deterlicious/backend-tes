const { validateDeviceAction, validateGetDevices } = require("../../../validators/deviceValidator");
const mongoose = require("mongoose");

describe("Unit Test Validator — Device", () => {
  describe("1. validateDeviceAction (Approve/Revoke/Self-Approve)", () => {
    test("Menolak jika payload benar-benar kosong atau tidak terdefinisi", () => {
      const resultKosong = validateDeviceAction({});
      expect(resultKosong.valid).toBe(false);
      expect(resultKosong.errors).toContain("installationId wajib disertakan dan tidak boleh kosong.");

      const resultNull = validateDeviceAction(null);
      expect(resultNull.valid).toBe(false);
    });

    test("Menolak dengan tegas jika 'installationId' hanya berisi spasi kosong (Whitespace Bypass)", () => {
      const resultSpasi = validateDeviceAction({ installationId: "      " });
      expect(resultSpasi.valid).toBe(false);
      expect(resultSpasi.errors[0]).toMatch(/tidak boleh kosong/i);
    });

    test("Lolos validasi jika 'installationId' dikirim dengan benar", () => {
      const resultValid = validateDeviceAction({ installationId: "DEV-UUID-999" });
      expect(resultValid.valid).toBe(true);
      expect(resultValid.errors).toBeUndefined();
    });
  });

  describe("2. validateGetDevices (Daftar Perangkat Kasir)", () => {
    const validObjectId = new mongoose.Types.ObjectId().toString();

    test("Menolak jika payload kosong atau 'userId' tidak disertakan", () => {
      const resultKosong = validateGetDevices({});
      expect(resultKosong.valid).toBe(false);
      expect(resultKosong.errors).toContain("userId wajib disertakan untuk melihat daftar perangkat.");
    });

    test("Menolak akses jika 'userId' bukan format Mongoose ObjectId yang valid (Mencegah Error DB/NoSQL Injection)", () => {
      const resultCacat = validateGetDevices({ userId: "bukan-id-database" });
      expect(resultCacat.valid).toBe(false);
      expect(resultCacat.errors).toContain("Format userId tidak valid.");
    });

    test("Lolos validasi 100% jika 'userId' berformat ObjectId murni", () => {
      const resultValid = validateGetDevices({ userId: validObjectId });
      expect(resultValid.valid).toBe(true);
      expect(resultValid.errors).toBeUndefined();
    });
  });
});