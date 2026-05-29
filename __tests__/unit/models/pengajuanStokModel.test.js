const mongoose = require("mongoose");
const PengajuanStok = require("../../../models/pengajuanStokModel");

describe("PengajuanStokModel — Unit Test", () => {
  // ══════════════════════════════════════════════════════════════════════════
  // HELPER MOCK DATA
  // ══════════════════════════════════════════════════════════════════════════
  const id = () => new mongoose.Types.ObjectId();
  
  const createValidPayload = (overrides = {}) => ({
    nomorPengajuan: "PGJ-TEST-001",
    tenantID: id(),
    dariLocationID: id(),
    keLocationID: id(),
    dimintaOleh: id(),
    items: [
      {
        bahanBakuID: id(),
        jumlah: 50,
        satuan: "kg"
      }
    ],
    ...overrides
  });

  // ══════════════════════════════════════════════════════════════════════════
  // A. HAPPY PATH
  // ══════════════════════════════════════════════════════════════════════════
  describe("A. Happy Path — Data Valid", () => {
    test("1. Berhasil membuat instance PengajuanStok dengan data valid minimum", () => {
      const payload = createValidPayload();
      const pengajuan = new PengajuanStok(payload);
      
      const error = pengajuan.validateSync();
      expect(error).toBeUndefined();
    });

    test("2. Berhasil membuat instance dengan semua field opsional terisi", () => {
      const payload = createValidPayload({
        jenisPengajuan: "PENGIRIMAN",
        disetujuiOleh: id(),
        ditolakOleh: id(),
        transferStokID: id(),
        status: "APPROVED",
        catatan: "Catatan testing",
        catatanPenolakan: "Ditolak karena kurang detail",
        tanggalKebutuhan: new Date(),
        tanggalApprove: new Date(),
        tanggalReject: new Date()
      });
      const pengajuan = new PengajuanStok(payload);
      
      const error = pengajuan.validateSync();
      expect(error).toBeUndefined();
      expect(pengajuan.status).toBe("APPROVED");
      expect(pengajuan.jenisPengajuan).toBe("PENGIRIMAN");
      expect(pengajuan.catatan).toBe("Catatan testing");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // B. REQUIRED FIELDS VALIDATION
  // ══════════════════════════════════════════════════════════════════════════
  describe("B. Validasi Field Wajib (Required)", () => {
    const requiredFields = [
      "nomorPengajuan",
      "tenantID",
      "dariLocationID",
      "keLocationID",
      "dimintaOleh"
    ];

    requiredFields.forEach((field) => {
      test(`1. Gagal jika field wajib '${field}' tidak ada`, () => {
        const payload = createValidPayload();
        delete payload[field];
        
        const pengajuan = new PengajuanStok(payload);
        const error = pengajuan.validateSync();
        
        expect(error).toBeDefined();
        expect(error.errors[field]).toBeDefined();
        expect(error.errors[field].kind).toBe("required");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // C. DEFAULT VALUES
  // ══════════════════════════════════════════════════════════════════════════
  describe("C. Nilai Default (Default Values)", () => {
    test("1. Field 'jenisPengajuan' default ke 'PERMINTAAN'", () => {
      const payload = createValidPayload();
      const pengajuan = new PengajuanStok(payload);
      
      expect(pengajuan.jenisPengajuan).toBe("PERMINTAAN");
    });

    test("2. Field 'status' default ke 'DRAFT'", () => {
      const payload = createValidPayload();
      const pengajuan = new PengajuanStok(payload);
      
      expect(pengajuan.status).toBe("DRAFT");
    });

    test("3. Field 'transferStokID' default ke null", () => {
      const payload = createValidPayload();
      const pengajuan = new PengajuanStok(payload);
      
      expect(pengajuan.transferStokID).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // D. ENUM VALIDATION
  // ══════════════════════════════════════════════════════════════════════════
  describe("D. Validasi Enum", () => {
    test("1. Berhasil jika 'jenisPengajuan' sesuai Enum", () => {
      const payload = createValidPayload({ jenisPengajuan: "PENGIRIMAN" });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      expect(error).toBeUndefined();
    });

    test("2. Gagal jika 'jenisPengajuan' di luar Enum", () => {
      const payload = createValidPayload({ jenisPengajuan: "TUKAR_TAMBAH" });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.jenisPengajuan).toBeDefined();
      expect(error.errors.jenisPengajuan.kind).toBe("enum");
    });

    test("3. Berhasil jika 'status' sesuai Enum", () => {
      const validStatuses = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "COMPLETED"];
      
      validStatuses.forEach((status) => {
        const payload = createValidPayload({ status });
        const pengajuan = new PengajuanStok(payload);
        const error = pengajuan.validateSync();
        expect(error).toBeUndefined();
      });
    });

    test("4. Gagal jika 'status' di luar Enum", () => {
      const payload = createValidPayload({ status: "SEDANG_DIKIRIM" });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.status).toBeDefined();
      expect(error.errors.status.kind).toBe("enum");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // E. NESTED ARRAY VALIDATION (items)
  // ══════════════════════════════════════════════════════════════════════════
  describe("E. Validasi Nested Array (items)", () => {
    test("1. Berhasil jika items adalah array kosong (schema memperbolehkan)", () => {
      const payload = createValidPayload({ items: [] });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      expect(error).toBeUndefined();
    });

    test("2. Gagal jika item tidak memiliki bahanBakuID", () => {
      const payload = createValidPayload({
        items: [{ jumlah: 10, satuan: "kg" }]
      });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors["items.0.bahanBakuID"]).toBeDefined();
    });

    test("3. Gagal jika item tidak memiliki jumlah", () => {
      const payload = createValidPayload({
        items: [{ bahanBakuID: id(), satuan: "kg" }]
      });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors["items.0.jumlah"]).toBeDefined();
    });

    test("4. Gagal jika item tidak memiliki satuan", () => {
      const payload = createValidPayload({
        items: [{ bahanBakuID: id(), jumlah: 10 }]
      });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors["items.0.satuan"]).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // F. TIPE DATA MONGODB
  // ══════════════════════════════════════════════════════════════════════════
  describe("F. Tipe Data ObjectId & Angka", () => {
    test("1. Gagal jika dariLocationID diisi dengan tipe yang salah", () => {
      const payload = createValidPayload({ dariLocationID: "bukan-object-id" });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors.dariLocationID.name).toBe("CastError");
    });

    test("2. Mongoose otomatis mengkonversi tipe string angka menjadi Number untuk jumlah", () => {
      const payload = createValidPayload({
        items: [{ bahanBakuID: id(), jumlah: "50", satuan: "kg" }]
      });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeUndefined();
      expect(pengajuan.items[0].jumlah).toBe(50); // Harus terkonversi jadi number 50
    });

    test("3. Gagal jika jumlah diisi dengan string huruf", () => {
      const payload = createValidPayload({
        items: [{ bahanBakuID: id(), jumlah: "lima puluh", satuan: "kg" }]
      });
      const pengajuan = new PengajuanStok(payload);
      const error = pengajuan.validateSync();
      
      expect(error).toBeDefined();
      expect(error.errors["items.0.jumlah"].name).toBe("CastError");
    });
  });
});
