const diskonService = require("../../../services/diskonService");
const Diskon = require("../../../models/diskonModel");
const redis = require("../../../config/redis");
const {
  validateDiskonPayload,
} = require("../../../validators/diskonValidator");

jest.mock("../../../models/diskonModel");
jest.mock("../../../validators/diskonValidator");
jest.mock("../../../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
}));

describe("Unit Test — Service — Diskon", () => {
  const mockTenantID = "tenant_1";
  const mockDoc = {
    _id: "diskon_1",
    tenantID: mockTenantID,
    namaDiskon: "Promo 10%",
    cakupan: "Global",
    tipe: "persen",
    nilai: 10,
    bisaDigabung: false,
    status: "Aktif",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChain = (value) => ({
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Internal Method: clearCache", () => {
    test("Sukses membersihkan cache list menggunakan pola SCAN", async () => {
      // Mocking redis.scan agar mengembalikan kursor "0" (selesai) di pemanggilan pertama
      redis.scan.mockResolvedValueOnce([
        "0",
        ["diskon:list:tenant_1:{}", "diskon:list:tenant_1:{status:Aktif}"],
      ]);

      await diskonService.clearCache(mockTenantID);

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `diskon:list:${mockTenantID}:*`,
        "COUNT",
        100,
      );
      expect(redis.del).toHaveBeenCalledWith(
        "diskon:list:tenant_1:{}",
        "diskon:list:tenant_1:{status:Aktif}",
      );
    });

    test("Sukses membersihkan cache list dan cache detail spesifik jika id dikirim", async () => {
      redis.scan.mockResolvedValueOnce(["0", ["diskon:list:tenant_1:{}"]]);

      await diskonService.clearCache(mockTenantID, "diskon_1");

      expect(redis.del).toHaveBeenCalledWith(
        "diskon:list:tenant_1:{}",
        "diskon:detail:diskon_1",
      );
    });

    test("Tidak memanggil redis.del jika tidak ada keys cache yang ditemukan", async () => {
      redis.scan.mockResolvedValueOnce(["0", []]); // Tidak ada keys

      await diskonService.clearCache(mockTenantID);

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe("Method: getAll", () => {
    test("Gagal (Throw 400) jika tenantID tidak disertakan", async () => {
      await expect(diskonService.getAll()).rejects.toThrow(
        /Tenant ID required/i,
      );
    });

    test("Sukses (Cache Hit) mengembalikan data dari Redis dan menyusun FilterKey dengan benar", async () => {
      redis.get.mockResolvedValue(JSON.stringify([mockDoc]));

      const result = await diskonService.getAll(mockTenantID, {
        status: "Aktif",
      });

      const expectedFilterKey = JSON.stringify({
        tenantID: mockTenantID,
        status: "Aktif",
      });
      expect(redis.get).toHaveBeenCalledWith(
        `diskon:list:${mockTenantID}:${expectedFilterKey}`,
      );
      expect(result).toHaveLength(1);
      expect(Diskon.find).not.toHaveBeenCalled();
    });

    test("Sukses (Cache Miss) mengambil data dari DB, menyimpan ke Redis, dan menerapkan filter query", async () => {
      redis.get.mockResolvedValue(null);
      Diskon.find.mockReturnValue(mockChain([mockDoc]));

      const query = { status: "Aktif", cakupan: "Global", tipe: "persen" };
      await diskonService.getAll(mockTenantID, query);

      expect(Diskon.find).toHaveBeenCalledWith({
        tenantID: mockTenantID,
        ...query,
      });
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe("Method: getById", () => {
    test("Sukses (Cache Hit) mengembalikan data jika tenantID pada cache sesuai dengan request", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await diskonService.getById("diskon_1", mockTenantID);
      expect(result._id).toBe("diskon_1");
    });

    test("Gagal (Mengembalikan null) meskipun ada di cache jika tenantID berbeda (Keamanan Isoloasi)", async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockDoc));
      const result = await diskonService.getById("diskon_1", "tenant_hacker");
      expect(result).toBeNull();
    });

    test("Sukses (Cache Miss) mengambil data detail dari DB", async () => {
      redis.get.mockResolvedValue(null);
      Diskon.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await diskonService.getById("diskon_1", mockTenantID);

      expect(Diskon.findOne).toHaveBeenCalledWith({
        _id: "diskon_1",
        tenantID: mockTenantID,
      });
      expect(redis.set).toHaveBeenCalled();
      expect(result._id).toBe("diskon_1");
    });
  });

  describe("Method: create", () => {
    const payload = {
      tenantID: mockTenantID,
      namaDiskon: "Baru",
      cakupan: "Item",
      tipe: "nominal",
      nilai: 5000,
    };

    test("Gagal jika validasi payload tidak lolos", async () => {
      validateDiskonPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid"],
      });
      const result = await diskonService.create(payload);
      expect(result.error).toEqual(["Invalid"]);
    });

    test("Sukses membuat diskon, membersihkan cache, dan mereturn data terformat", async () => {
      validateDiskonPayload.mockReturnValue({ valid: true });
      Diskon.create.mockResolvedValue({ _id: "diskon_new" });
      Diskon.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...payload, _id: "diskon_new" }),
      });

      // Mocking clearCache internal agar tidak memanggil redis beneran
      jest.spyOn(diskonService, "clearCache").mockResolvedValue();

      const result = await diskonService.create(payload);

      expect(Diskon.create).toHaveBeenCalledWith(payload);
      expect(diskonService.clearCache).toHaveBeenCalledWith(mockTenantID);
      expect(result._id).toBe("diskon_new");
    });

    test("Menangkap dan melempar (Throw 400) jika error duplicate namaDiskon (11000)", async () => {
      validateDiskonPayload.mockReturnValue({ valid: true });
      const mongoError = new Error("Duplicate");
      mongoError.code = 11000;
      Diskon.create.mockRejectedValue(mongoError);

      await expect(diskonService.create(payload)).rejects.toThrow(
        /Nama diskon sudah digunakan/i,
      );
    });
  });

  describe("Method: update", () => {
    test("Gagal jika payload update tidak valid", async () => {
      validateDiskonPayload.mockReturnValue({
        valid: false,
        errors: ["Invalid Update"],
      });
      const result = await diskonService.update("diskon_1", {}, mockTenantID);
      expect(result.error).toEqual(["Invalid Update"]);
    });

    test("Sukses memperbarui data, menghapus tenantID dari payload (mencegah hijack), dan membersihkan cache", async () => {
      validateDiskonPayload.mockReturnValue({ valid: true });
      Diskon.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDoc),
      });
      jest.spyOn(diskonService, "clearCache").mockResolvedValue();

      const payload = { tenantID: "tenant_hacker", status: "Non-Aktif" };
      const result = await diskonService.update(
        "diskon_1",
        payload,
        mockTenantID,
      );

      expect(payload.tenantID).toBeUndefined(); // Bukti payload.tenantID di-delete
      expect(Diskon.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "diskon_1", tenantID: mockTenantID },
        payload,
        expect.any(Object),
      );
      expect(diskonService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "diskon_1",
      );
      expect(result._id).toBe("diskon_1");
    });

    test("Menangkap dan melempar (Throw 400) jika error duplicate saat update (11000)", async () => {
      validateDiskonPayload.mockReturnValue({ valid: true });
      const mongoError = new Error("Duplicate Update");
      mongoError.code = 11000;
      Diskon.findOneAndUpdate.mockImplementation(() => {
        throw mongoError;
      });

      await expect(
        diskonService.update("diskon_1", {}, mockTenantID),
      ).rejects.toThrow(/Nama diskon sudah digunakan/i);
    });
  });

  describe("Method: delete", () => {
    test("Gagal (Return null) jika data diskon tidak ditemukan di database saat akan dihapus", async () => {
      Diskon.deleteOne.mockResolvedValue({ deletedCount: 0 });
      const result = await diskonService.delete("diskon_1", mockTenantID);
      expect(result).toBeNull();
    });

    test("Sukses menghapus data dari DB dan membersihkan cache", async () => {
      Diskon.deleteOne.mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(diskonService, "clearCache").mockResolvedValue();

      const result = await diskonService.delete("diskon_1", mockTenantID);

      expect(diskonService.clearCache).toHaveBeenCalledWith(
        mockTenantID,
        "diskon_1",
      );
      expect(result).toBe(true);
    });
  });

  describe("Method: validateKombinasiDiskon", () => {
    test("Sukses jika tidak ada diskon (kosong) atau hanya 1 diskon yang digunakan", async () => {
      expect(
        (await diskonService.validateKombinasiDiskon([], mockTenantID)).valid,
      ).toBe(true);
      expect(
        (
          await diskonService.validateKombinasiDiskon(
            ["diskon_1"],
            mockTenantID,
          )
        ).valid,
      ).toBe(true);
    });

    test("Gagal jika ada ID diskon yang dikirim tetapi tidak ditemukan di DB (status non-aktif/beda tenant)", async () => {
      // Meminta validasi 2 diskon, tetapi DB hanya mengembalikan 1
      Diskon.find.mockReturnValue(
        mockChain([{ _id: "diskon_1", bisaDigabung: true }]),
      );
      const result = await diskonService.validateKombinasiDiskon(
        ["diskon_1", "diskon_2"],
        mockTenantID,
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(
        /tidak valid \/ non-aktif \/ beda tenant/i,
      );
    });

    test("Gagal jika kombinasi melibatkan diskon yang bersifat non-stackable (bisaDigabung: false)", async () => {
      Diskon.find.mockReturnValue(
        mockChain([
          { _id: "diskon_1", bisaDigabung: true },
          { _id: "diskon_2", bisaDigabung: false }, // Biang kerok
        ]),
      );

      const result = await diskonService.validateKombinasiDiskon(
        ["diskon_1", "diskon_2"],
        mockTenantID,
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(
        /Terdapat diskon yang tidak bisa digabung/i,
      );
    });

    test("Sukses jika semua kombinasi diskon bersifat stackable (bisaDigabung: true)", async () => {
      Diskon.find.mockReturnValue(
        mockChain([
          { _id: "diskon_1", bisaDigabung: true },
          { _id: "diskon_2", bisaDigabung: true },
        ]),
      );

      const result = await diskonService.validateKombinasiDiskon(
        ["diskon_1", "diskon_2"],
        mockTenantID,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("Method: hitungDanValidasiPotongan", () => {
    test("Gagal jika ID diskon tidak ditemukan di database", async () => {
      jest.spyOn(diskonService, "getById").mockResolvedValue(null);
      const result = await diskonService.hitungDanValidasiPotongan(
        "diskon_x",
        100000,
        "Global",
        mockTenantID,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/tidak valid atau tidak ditemukan/i);
    });

    test("Gagal jika diskon ditemukan namun berstatus Non-Aktif", async () => {
      jest
        .spyOn(diskonService, "getById")
        .mockResolvedValue({ status: "Non-Aktif" });
      const result = await diskonService.hitungDanValidasiPotongan(
        "diskon_1",
        100000,
        "Global",
        mockTenantID,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/sedang tidak aktif/i);
    });

    test("Gagal jika cakupan diskon tidak sesuai dengan yang diminta (Contoh: Minta Item, tapi diskon Global)", async () => {
      jest
        .spyOn(diskonService, "getById")
        .mockResolvedValue({ status: "Aktif", cakupan: "Global" });
      const result = await diskonService.hitungDanValidasiPotongan(
        "diskon_1",
        100000,
        "Item",
        mockTenantID,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/tidak bisa digunakan sebagai diskon/i);
    });

    test("Sukses menghitung potongan tipe 'persen' dengan benar", async () => {
      jest
        .spyOn(diskonService, "getById")
        .mockResolvedValue({
          status: "Aktif",
          cakupan: "Global",
          tipe: "persen",
          nilai: 10,
        });
      // 10% dari 100.000 = 10.000. Harga akhir = 90.000
      const result = await diskonService.hitungDanValidasiPotongan(
        "diskon_1",
        100000,
        "Global",
        mockTenantID,
      );

      expect(result.valid).toBe(true);
      expect(result.potongan).toBe(10000);
      expect(result.hargaAkhir).toBe(90000);
    });

    test("Sukses menghitung potongan tipe 'nominal' dengan benar", async () => {
      jest
        .spyOn(diskonService, "getById")
        .mockResolvedValue({
          status: "Aktif",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 25000,
        });
      // 100.000 - 25.000 = 75.000
      const result = await diskonService.hitungDanValidasiPotongan(
        "diskon_1",
        100000,
        "Global",
        mockTenantID,
      );

      expect(result.valid).toBe(true);
      expect(result.potongan).toBe(25000);
      expect(result.hargaAkhir).toBe(75000);
    });

    test("Gagal (Keamanan) jika nominal potongan diskon lebih besar dari harga awal (mencegah minus)", async () => {
      // Diskon 150.000, padahal harga awal cuma 100.000
      jest
        .spyOn(diskonService, "getById")
        .mockResolvedValue({
          status: "Aktif",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 150000,
        });

      const result = await diskonService.hitungDanValidasiPotongan(
        "diskon_1",
        100000,
        "Global",
        mockTenantID,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/melebihi total harga/i);
    });
  });
});
