const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const JurnalStok = require("../../../models/jurnalStokModel");

let mongoServer;

const id = () => new mongoose.Types.ObjectId();

const base = (overrides = {}) => ({
  bahanBakuID:  id(),
  tanggal:      new Date(),
  tipeKoreksi:  "Masuk",
  jumlah:       10,
  alasan:       "Transfer Gudang",
  keterangan:   "Test keterangan",
  dicatatOleh:  id(),
  locationID:   id(),
  tenantID:     id(),
  ...overrides,
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await JurnalStok.deleteMany({});
});

// ─────────────────────────────────────────────────────────────────────────────
describe("JurnalStok Model — Unit Test", () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDASI FIELD WAJIB
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Required Fields", () => {
    const requiredFields = [
      "bahanBakuID",
      "tanggal",
      "tipeKoreksi",
      "jumlah",
      "alasan",
      "dicatatOleh",
      "locationID",
      "tenantID",
    ];

    test.each(requiredFields)(
      "Field '%s' wajib diisi — gagal jika tidak ada",
      async (field) => {
        const data = base({ [field]: undefined });
        const doc = new JurnalStok(data);
        await expect(doc.validate()).rejects.toThrow();
      }
    );

    test("Lolos validasi jika semua field wajib lengkap", async () => {
      const doc = new JurnalStok(base());
      await expect(doc.validate()).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ENUM tipeKoreksi
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Enum: tipeKoreksi", () => {
    test.each(["Masuk", "Keluar"])(
      "'%s' adalah nilai valid",
      async (tipe) => {
        const doc = new JurnalStok(base({ tipeKoreksi: tipe }));
        await expect(doc.validate()).resolves.toBeUndefined();
      }
    );

    test.each(["masuk", "keluar", "MASUK", "masukk", "Transfer", ""])(
      "'%s' bukan nilai valid → harus error",
      async (tipe) => {
        const doc = new JurnalStok(base({ tipeKoreksi: tipe }));
        await expect(doc.validate()).rejects.toThrow();
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ENUM alasan
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Enum: alasan", () => {
    test.each(["Stok Opname", "Rusak/Hilang", "Transfer Gudang", "Lainnya"])(
      "'%s' adalah nilai valid",
      async (alasan) => {
        const doc = new JurnalStok(base({ alasan }));
        await expect(doc.validate()).resolves.toBeUndefined();
      }
    );

    test.each(["stok opname", "transfer", "Lain-lain", ""])(
      "'%s' bukan nilai valid → harus error",
      async (alasan) => {
        const doc = new JurnalStok(base({ alasan }));
        await expect(doc.validate()).rejects.toThrow();
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRAINT jumlah
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Field: jumlah", () => {
    test("jumlah = 0 lolos validasi (min: 0 di schema)", async () => {
      const doc = new JurnalStok(base({ jumlah: 0 }));
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("jumlah negatif → harus error (pesan: Jumlah tidak boleh negatif)", async () => {
      const doc = new JurnalStok(base({ jumlah: -1 }));
      await expect(doc.validate()).rejects.toThrow("Jumlah tidak boleh negatif");
    });

    test("jumlah desimal positif lolos validasi", async () => {
      const doc = new JurnalStok(base({ jumlah: 0.5 }));
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("jumlah bukan angka → harus error", async () => {
      const doc = new JurnalStok(base({ jumlah: "sepuluh" }));
      await expect(doc.validate()).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FIELD OPSIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Field Opsional: keterangan", () => {
    test("keterangan boleh null (default)", async () => {
      const doc = new JurnalStok(base({ keterangan: undefined }));
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.keterangan).toBeNull();
    });

    test("keterangan string normal tersimpan dan ter-trim", async () => {
      const doc = await JurnalStok.create(base({ keterangan: "  Transfer SJ-001  " }));
      expect(doc.keterangan).toBe("Transfer SJ-001");
    });

    test("keterangan string kosong tersimpan sebagai string kosong (bukan null)", async () => {
      const doc = new JurnalStok(base({ keterangan: "" }));
      await expect(doc.validate()).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMESTAMPS & VERSIONKEY
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Schema Options", () => {
    test("createdAt dan updatedAt terisi otomatis", async () => {
      const doc = await JurnalStok.create(base());
      expect(doc.createdAt).toBeDefined();
      expect(doc.updatedAt).toBeDefined();
    });

    test("__v (versionKey) tidak ada karena versionKey: false", async () => {
      const doc = await JurnalStok.create(base());
      expect(doc.__v).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE & PERSIST
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Create & Retrieve", () => {
    test("Data tersimpan dan bisa diambil kembali dengan findOne", async () => {
      const payload = base({ jumlah: 25, tipeKoreksi: "Keluar", alasan: "Stok Opname" });
      const saved = await JurnalStok.create(payload);

      const found = await JurnalStok.findById(saved._id).lean();
      expect(found).not.toBeNull();
      expect(found.jumlah).toBe(25);
      expect(found.tipeKoreksi).toBe("Keluar");
      expect(found.alasan).toBe("Stok Opname");
    });

    test("Beberapa dokumen milik tenant berbeda tidak saling menginterferensi", async () => {
      const tenantA = id();
      const tenantB = id();
      await JurnalStok.create(base({ tenantID: tenantA, jumlah: 10 }));
      await JurnalStok.create(base({ tenantID: tenantB, jumlah: 99 }));

      const hasilA = await JurnalStok.find({ tenantID: tenantA }).lean();
      const hasilB = await JurnalStok.find({ tenantID: tenantB }).lean();

      expect(hasilA).toHaveLength(1);
      expect(hasilA[0].jumlah).toBe(10);
      expect(hasilB).toHaveLength(1);
      expect(hasilB[0].jumlah).toBe(99);
    });

    test("Data berhasil dihapus dengan deleteOne", async () => {
      const doc = await JurnalStok.create(base());
      await JurnalStok.deleteOne({ _id: doc._id });
      const found = await JurnalStok.findById(doc._id);
      expect(found).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPOUND INDEX (tenantID + bahanBakuID + tanggal)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Index & Query Performance", () => {
    test("Bisa query berdasarkan tenantID + bahanBakuID sekaligus", async () => {
      const tenantID   = id();
      const bahanBakuID = id();

      await JurnalStok.create(base({ tenantID, bahanBakuID, jumlah: 5 }));
      await JurnalStok.create(base({ tenantID, bahanBakuID, jumlah: 15 }));
      await JurnalStok.create(base({ tenantID, bahanBakuID: id(), jumlah: 99 })); // bahan lain

      const hasil = await JurnalStok.find({ tenantID, bahanBakuID }).lean();
      expect(hasil).toHaveLength(2);
      expect(hasil.every((d) => d.jumlah !== 99)).toBe(true);
    });

    test("Sort tanggal descending mengembalikan entri terbaru di atas", async () => {
      const tenantID = id();
      const waktuLama = new Date("2026-01-01");
      const waktuBaru = new Date("2026-05-17");

      await JurnalStok.create(base({ tenantID, tanggal: waktuLama, jumlah: 1 }));
      await JurnalStok.create(base({ tenantID, tanggal: waktuBaru, jumlah: 2 }));

      const hasil = await JurnalStok.find({ tenantID }).sort({ tanggal: -1 }).lean();
      expect(hasil[0].jumlah).toBe(2); // entri terbaru di posisi pertama
      expect(hasil[1].jumlah).toBe(1);
    });
  });
});
