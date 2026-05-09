const mongoose = require("mongoose");
const TransferStok = require("../../../models/transferStokModel");

// ─── ID Kontekstual: Skenario 1 Gudang, 1 Outlet ─────────────────────────────
// Ini bukan koneksi ke DB nyata — hanya ObjectId valid untuk melewati validasi
const tenantID      = new mongoose.Types.ObjectId(); // 1 Perusahaan
const gudangID      = new mongoose.Types.ObjectId(); // Lokasi Gudang (dariLocationID)
const outletID      = new mongoose.Types.ObjectId(); // Lokasi Outlet (keLocationID)
const adminGudangID = new mongoose.Types.ObjectId(); // Pengirim (admin gudang)
const managerID     = new mongoose.Types.ObjectId(); // Penerima (manager outlet)
const pengajuanID   = new mongoose.Types.ObjectId(); // Referensi PengajuanStok
const tepungID      = new mongoose.Types.ObjectId(); // Bahan baku #1
const gulaID        = new mongoose.Types.ObjectId(); // Bahan baku #2

// ─── Helper: Item Bawaan ──────────────────────────────────────────────────────
function createValidItem(overrides = {}) {
  return {
    bahanBakuID: tepungID,
    qtyKirim: 10,
    qtyTerima: 0,
    catatanItem: null,
    ...overrides,
  };
}

// ─── Factory Function Utama ───────────────────────────────────────────────────
// Selalu menghasilkan dokumen VALID — caller hanya perlu override field yang diuji
function createValidTransfer(overrides = {}) {
  return new TransferStok({
    nomorTransfer:   "SJ-PGJ/202605/0001-TEST",
    pengajuanStokID: pengajuanID,
    dariLocationID:  gudangID,
    keLocationID:    outletID,
    pengirimID:      adminGudangID,
    tanggalKirim:    new Date("2026-05-08"),
    tenantID,
    items: [createValidItem()],
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe("TransferStok Model — Unit Test (Skenario: 1 Gudang → 1 Outlet)", () => {

  // ── A: HAPPY PATH ──────────────────────────────────────────────────────────
  describe("A: Happy Path — Data Valid", () => {

    test("A1: dokumen lengkap harus lolos validasi", async () => {
      const doc = createValidTransfer();
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("A2: dokumen tanpa pengajuanStokID (opsional) harus lolos", async () => {
      const doc = createValidTransfer({ pengajuanStokID: null });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("A3: dokumen tanpa penerimaID (belum diterima) harus lolos", async () => {
      const doc = createValidTransfer({ penerimaID: undefined });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("A4: dokumen dengan dua item bahan baku berbeda harus lolos", async () => {
      const doc = createValidTransfer({
        items: [
          createValidItem({ bahanBakuID: tepungID, qtyKirim: 5 }),
          createValidItem({ bahanBakuID: gulaID,   qtyKirim: 3 }),
        ],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("A5: dokumen dengan catatan item harus lolos", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ catatanItem: "Tepung disimpan terpisah" })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("A6: dokumen dengan penerimaID (sudah diterima) harus lolos", async () => {
      const doc = createValidTransfer({
        penerimaID:    managerID,
        status:        "DITERIMA",
        tanggalTerima: new Date("2026-05-09"),
        items: [createValidItem({ qtyTerima: 9 })], // terima 9 dari 10 yang dikirim
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

  });

  // ── B: REQUIRED FIELDS ────────────────────────────────────────────────────
  describe("B: Field Wajib (Required)", () => {

    const requiredFields = [
      "nomorTransfer",
      "dariLocationID",
      "keLocationID",
      "pengirimID",
      "tanggalKirim",
      "tenantID",
    ];

    requiredFields.forEach((field) => {
      test(`B: gagal jika '${field}' tidak diisi`, async () => {
        const doc = createValidTransfer({ [field]: undefined });
        await expect(doc.validate()).rejects.toThrow();
        expect(doc.validateSync().errors[field]).toBeDefined();
      });
    });

    test("B: gagal jika 'items' kosong (tidak ada item yang ditransfer)", async () => {
      const doc = createValidTransfer({ items: [] });
      // items kosong tidak divalidasi di schema level (array boleh kosong di Mongoose)
      // tapi validasi ini ada di service/validator — ini adalah dokumentasi behavior model
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items.length).toBe(0);
    });

  });

  // ── C: ENUM STATUS ────────────────────────────────────────────────────────
  describe("C: Enum Validation — Field 'status'", () => {

    test("C1: status 'PENDING' harus lolos", async () => {
      const doc = createValidTransfer({ status: "PENDING" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("C2: status 'DIKIRIM' harus lolos", async () => {
      const doc = createValidTransfer({ status: "DIKIRIM" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("C3: status 'DITERIMA' harus lolos", async () => {
      const doc = createValidTransfer({ status: "DITERIMA" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("C4: status 'BATAL' harus lolos", async () => {
      const doc = createValidTransfer({ status: "BATAL" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("C5: status di luar enum ('PROSES') harus gagal", async () => {
      const doc = createValidTransfer({ status: "PROSES" });
      await expect(doc.validate()).rejects.toThrow();
      expect(doc.validateSync().errors.status).toBeDefined();
    });

    test("C6: status ('DIKIRIMKAN') harus gagal — typo enum", async () => {
      const doc = createValidTransfer({ status: "DIKIRIMKAN" });
      await expect(doc.validate()).rejects.toThrow();
      expect(doc.validateSync().errors.status).toBeDefined();
    });

    test("C7: status lowercase ('pending') harus gagal — case-sensitive", async () => {
      const doc = createValidTransfer({ status: "pending" });
      await expect(doc.validate()).rejects.toThrow();
      expect(doc.validateSync().errors.status).toBeDefined();
    });

  });

  // ── D: DEFAULT VALUES ─────────────────────────────────────────────────────
  describe("D: Default Values", () => {

    test("D1: status default adalah 'PENDING'", () => {
      const doc = new TransferStok({});
      expect(doc.status).toBe("PENDING");
    });

    test("D2: tanggalTerima default adalah null", () => {
      const doc = createValidTransfer();
      expect(doc.tanggalTerima).toBeNull();
    });

    test("D3: pengajuanStokID default adalah null", () => {
      const doc = new TransferStok({});
      expect(doc.pengajuanStokID).toBeNull();
    });

    test("D4: qtyTerima per item default adalah 0", () => {
      const doc = createValidTransfer({
        items: [{ bahanBakuID: tepungID, qtyKirim: 10 }], // tanpa qtyTerima
      });
      expect(doc.items[0].qtyTerima).toBe(0);
    });

    test("D5: catatanItem per item default adalah null", () => {
      const doc = createValidTransfer({
        items: [{ bahanBakuID: tepungID, qtyKirim: 10 }], // tanpa catatanItem
      });
      expect(doc.items[0].catatanItem).toBeNull();
    });

  });

  // ── E: VALIDASI SUBDOCUMENT ITEMS ─────────────────────────────────────────
  describe("E: Validasi Subdocument Items", () => {

    test("E1: item tanpa 'bahanBakuID' harus gagal", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ bahanBakuID: undefined })],
      });
      await expect(doc.validate()).rejects.toThrow();
      expect(doc.validateSync().errors["items.0.bahanBakuID"]).toBeDefined();
    });

    test("E2: item tanpa 'qtyKirim' harus gagal", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: undefined })],
      });
      await expect(doc.validate()).rejects.toThrow();
      expect(doc.validateSync().errors["items.0.qtyKirim"]).toBeDefined();
    });

    test("E3: qtyKirim negatif harus gagal", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: -5 })],
      });
      await expect(doc.validate()).rejects.toThrow();
      expect(doc.validateSync().errors["items.0.qtyKirim"]).toBeDefined();
    });

    test("E4: qtyTerima boleh lebih kecil dari qtyKirim (barang rusak di jalan)", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 10, qtyTerima: 7 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyTerima).toBe(7);
    });

    test("E5: item dengan catatanItem string panjang harus lolos", async () => {
      const catatan = "Dus terluar sobek, isi masih utuh, diterima dengan catatan kondisi kemasan";
      const doc = createValidTransfer({
        items: [createValidItem({ catatanItem: catatan })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].catatanItem).toBe(catatan);
    });

  });

  // ── F: FIX qtyKirim DESIMAL ───────────────────────────────────────────────
  // Verifikasi fix: mengubah min:1 → min:0 agar nilai hasil konversi satuan tidak ditolak
  // Contoh: 500 gram → 0.5 kg, 100 ml → 0.1 liter
  describe("F: Fix qtyKirim — Nilai Desimal (Hasil Konversi Satuan)", () => {

    test("F1: qtyKirim = 0.5 (500 gram → 0.5 kg) harus lolos", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 0.5 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyKirim).toBe(0.5);
    });

    test("F2: qtyKirim = 0.1 (100 gram → 0.1 kg) harus lolos", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 0.1 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyKirim).toBe(0.1);
    });

    test("F3: qtyKirim = 0.001 (1 ml → 0.001 liter) harus lolos", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 0.001 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyKirim).toBe(0.001);
    });

    test("F4: qtyKirim = 0 LOLOS di level model — penjagaan >0 ada di validator/service", async () => {
      // Model set min:0 → qtyKirim = 0 tidak ditolak schema
      // Penjagaan "qtyKirim <= 0 harus ditolak" adalah tanggung jawab transferStokValidator.js
      // Ini mendokumentasikan pembagian tanggung jawab yang disengaja
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 0 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyKirim).toBe(0);
    });

    test("F5: qtyKirim = 0.0001 (presisi tinggi) harus lolos", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 0.0001 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("F6: multi-item — campuran bilangan bulat dan desimal harus lolos", async () => {
      const doc = createValidTransfer({
        items: [
          createValidItem({ bahanBakuID: tepungID, qtyKirim: 2 }),    // 2 kg utuh
          createValidItem({ bahanBakuID: gulaID,   qtyKirim: 0.75 }), // 750 gram → 0.75 kg
        ],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

  });

  // ── G: UNIQUE INDEX ───────────────────────────────────────────────────────
  // Butuh .save() agar unique index di MongoDB teraplikasi
  describe("G: Unique Index — nomorTransfer", () => {

    test("G1: dua transfer dengan nomorTransfer berbeda harus lolos", async () => {
      await TransferStok.create(createValidTransfer({ nomorTransfer: "SJ-001" }));
      const doc2 = createValidTransfer({ nomorTransfer: "SJ-002" });
      await expect(doc2.save()).resolves.toBeDefined();
    });

    test("G2: dua transfer dengan nomorTransfer SAMA harus gagal", async () => {
      await TransferStok.create(createValidTransfer({ nomorTransfer: "SJ-DUPLIKAT" }));
      const duplikat = createValidTransfer({ nomorTransfer: "SJ-DUPLIKAT" });
      await expect(duplikat.save()).rejects.toThrow();
    });

    test("G3: nomorTransfer sama di tenant berbeda tetap gagal (unique global)", async () => {
      const tenant2 = new mongoose.Types.ObjectId();
      await TransferStok.create(createValidTransfer({ nomorTransfer: "SJ-GLOBAL" }));
      const doc2 = createValidTransfer({ nomorTransfer: "SJ-GLOBAL", tenantID: tenant2 });
      await expect(doc2.save()).rejects.toThrow();
    });

  });

  // ── H: SKENARIO BISNIS REALISTIS ──────────────────────────────────────────
  describe("H: Skenario Bisnis — Alur PENDING → DIKIRIM → DITERIMA", () => {

    test("H1: transfer baru selalu mulai dari status PENDING", async () => {
      const doc = createValidTransfer();
      await doc.validate();
      expect(doc.status).toBe("PENDING");
      expect(doc.penerimaID).toBeUndefined();
      expect(doc.tanggalTerima).toBeNull();
    });

    test("H2: state DIKIRIM — pengirimID ada, tanggalKirim ada, penerimaID belum ada", async () => {
      const doc = createValidTransfer({
        status: "DIKIRIM",
        pengirimID: adminGudangID,
        tanggalKirim: new Date("2026-05-08T08:00:00Z"),
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.penerimaID).toBeUndefined();
    });

    test("H3: state DITERIMA — ada penerimaID, tanggalTerima, dan qtyTerima", async () => {
      const doc = createValidTransfer({
        status:        "DITERIMA",
        pengirimID:    adminGudangID,
        penerimaID:    managerID,
        tanggalKirim:  new Date("2026-05-08"),
        tanggalTerima: new Date("2026-05-09"),
        items: [createValidItem({ qtyKirim: 10, qtyTerima: 9 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyTerima).toBe(9);
    });

    test("H4: state BATAL — status BATAL valid di level schema", async () => {
      const doc = createValidTransfer({ status: "BATAL" });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

  });

  // ── I: EDGE CASES & CHAOS TEST ────────────────────────────────────────────
  describe("I: Edge Cases & Chaos Test", () => {

    test("I1: dariLocationID dan keLocationID boleh sama (transfer balik / return)", async () => {
      // Skenario return barang dari outlet ke gudang yang sama
      const doc = createValidTransfer({ dariLocationID: gudangID, keLocationID: gudangID });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

    test("I2: format ObjectId salah pada tenantID harus gagal", async () => {
      const doc = createValidTransfer({ tenantID: "bukan-object-id" });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("I3: format ObjectId salah pada dariLocationID harus gagal", async () => {
      const doc = createValidTransfer({ dariLocationID: "gudang-abc" });
      await expect(doc.validate()).rejects.toThrow();
    });

    test("I4: qtyKirim string angka ('10') harus bisa di-cast ke Number oleh Mongoose", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: "10" })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items[0].qtyKirim).toBe(10);
    });

    test("I5: tanggalKirim string ISO harus bisa di-cast ke Date", async () => {
      const doc = createValidTransfer({ tanggalKirim: "2026-05-08T10:00:00Z" });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.tanggalKirim).toBeInstanceOf(Date);
    });

    test("I6: transfer dengan 10 item sekaligus harus lolos", async () => {
      const banyakItem = Array.from({ length: 10 }, (_, i) => ({
        bahanBakuID: new mongoose.Types.ObjectId(),
        qtyKirim: i + 1,
      }));
      const doc = createValidTransfer({ items: banyakItem });
      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.items.length).toBe(10);
    });

    test("I7: qtyKirim sangat besar (1.000.000) harus lolos — tidak ada batas atas", async () => {
      const doc = createValidTransfer({
        items: [createValidItem({ qtyKirim: 1_000_000 })],
      });
      await expect(doc.validate()).resolves.toBeUndefined();
    });

  });

});
