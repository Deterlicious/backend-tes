const request = require("supertest");
const app = require("../../app");
const mongoose = require("mongoose");
const Permission = require("../../models/permissionModel");

const STATUS_TEXT = {
  200: "OK",
  201: "Created",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
};

const logResponse = (label, res) => {
  const detail =
    res.body?.message ||
    (Array.isArray(res.body?.errors) ? res.body.errors.join(" | ") : "") ||
    "";

  console.log(
    `${label} ${res.status} ${STATUS_TEXT[res.status] || ""} ${detail}`
  );
};

describe("Pembayaran — CRUD, Validasi, dan Efek ke Transaksi", () => {
  let tokenC;
  let akunKasID;
  let metodePembayaranID;
  let pelangganID;
  let kategoriID;
  let produkID;

  const dummyBahanBakuID = new mongoose.Types.ObjectId().toString();
  const unique = Date.now();

  beforeAll(async () => {
    await Permission.create([
      {
        nama: "kelola-pembayaran",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengatur pembayaran",
      },
      {
        nama: "kelola-akunkas",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengatur akun kas",
      },
      {
        nama: "kelola-metode-pembayaran",
        grup: "Pengaturan Toko",
        deskripsi: "Dapat mengatur metode pembayaran",
      },
      {
        nama: "kelola-pelanggan",
        grup: "Manajemen Pelanggan",
        deskripsi: "Dapat mengatur pelanggan",
      },
      {
        nama: "kelola-produk",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur produk",
      },
      {
        nama: "kelola-kategori",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur kategori",
      },
      {
        nama: "akses-pos",
        grup: "Transaksi",
        deskripsi: "Dapat melakukan transaksi kasir",
      },
    ]);

    await request(app).post("/api/akun/auth/register").send({
      email: `owner.pembayaran.${unique}@test.com`,
      password: "Password123!",
      username: `owner_pembayaran_${unique}`,
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: `owner.pembayaran.${unique}@test.com`,
      password: "Password123!",
      deviceID: `device-test-pembayaran-${unique}`,
    });

    const tokenA = loginRes.body.accessToken;
    if (!tokenA) throw new Error("Gagal mendapatkan Token A!");

    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: `Toko Test Pembayaran ${unique}` });

    const tokenB = tenantRes.body.tokens?.accessToken;
    if (!tokenB) throw new Error("Gagal mendapatkan Token B!");

    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Test Pembayaran", pin: "123456" });

    tokenC =
      penggunaRes.body.tokens?.accessToken ||
      penggunaRes.body.accessToken ||
      penggunaRes.body.data?.tokens?.accessToken;

    if (!tokenC) throw new Error("Gagal mendapatkan Token C!");

    const akunKasRes = await request(app)
      .post("/api/akunkas")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaAkun: `kas-${unique}`,
        saldo: 500000,
        tipeAkun: "Kas Fisik",
        nomorAkun: `123-${unique}`,
      });

    logResponse("CREATE AKUN KAS:", akunKasRes);

    akunKasID = akunKasRes.body.data?._id;
    if (!akunKasID) {
      throw new Error("Gagal membuat akun kas!");
    }

    const metodeRes = await request(app)
      .post("/api/metodepembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaPembayaran: `Uang Tunai / Cash ${unique}`,
        kategori: "tunai",
        akunKasID,
        isAutomated: false,
        isActive: true,
      });

    logResponse("CREATE METODE PEMBAYARAN:", metodeRes);

    metodePembayaranID = metodeRes.body.data?._id;
    if (!metodePembayaranID) {
      throw new Error("Gagal membuat metode pembayaran!");
    }

    const pelangganRes = await request(app)
      .post("/api/pelanggan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaPelanggan: "Pelanggan Test Bayar",
        tipePelanggan: "umum",
        nomorHp: "08199988877",
      });

    logResponse("CREATE PELANGGAN:", pelangganRes);

    pelangganID = pelangganRes.body.data?._id;
    if (!pelangganID) {
      throw new Error("Gagal membuat pelanggan!");
    }

    const kategoriRes = await request(app)
      .post("/api/kategori")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaKategori: `Kategori Pembayaran ${unique}`,
        kodeKategori: `KATPAY${String(unique).slice(-4)}`,
      });

    logResponse("CREATE KATEGORI:", kategoriRes);

    kategoriID = kategoriRes.body.data?._id;
    if (!kategoriID) {
      throw new Error("Gagal membuat kategori!");
    }

    const produkRes = await request(app)
      .post("/api/produk")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        namaProduk: "Kopi Test Bayar",
        hargaDasar: 5000,
        hargaJual: 10000,
        kategoriID,
        stok: 50,
        resep: [{ bahanBakuID: dummyBahanBakuID, jumlah: 100, satuan: "ml" }],
      });

    logResponse("CREATE PRODUK:", produkRes);

    produkID = produkRes.body.data?._id;
    if (!produkID) {
      throw new Error("Gagal membuat produk!");
    }
  });

  const createPenjualan = async ({
    suffix,
    jumlah = 2,
    simpanDraft = false,
    jenisTransaksi = "POS",
    jenisPenjualan = "dine-in",
  }) => {
    const noReferensi = `PAY-TEST-${suffix}-${unique}`;

    const penjualanRes = await request(app)
      .post("/api/penjualan")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        noReferensi,
        pelangganID,
        jenisTransaksi,
        jenisPenjualan,
        tanggalTransaksi: new Date().toISOString(),
        simpanDraft,
        itemPenjualan: [
          {
            produkID,
            jumlah,
          },
        ],
      });

    logResponse(`CREATE PENJUALAN ${suffix}:`, penjualanRes);

    const id = penjualanRes.body.data?._id;
    if (!id) {
      throw new Error(
        `Gagal membuat penjualan! Response: ${JSON.stringify(penjualanRes.body)}`
      );
    }

    return {
      penjualanID: id,
      noReferensi,
      raw: penjualanRes,
      totalTagihan: penjualanRes.body.data?.totalTagihan,
      jenisTransaksi,
    };
  };

  const getPenjualan = async (penjualanID) => {
    const res = await request(app)
      .get(`/api/penjualan/${penjualanID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("GET PENJUALAN:", res);
    return res;
  };

  const getAkunKas = async () => {
    const res = await request(app)
      .get(`/api/akunkas/${akunKasID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("GET AKUN KAS:", res);
    return res;
  };

  const createPembayaran = async ({
    penjualanID,
    jumlahBayar,
    status = "PAID",
    noReferensi = `PAY-REF-${unique}`,
    tanggalBayar,
    catatan = "Pembayaran test",
    akunKasOverride,
    metodePembayaranOverride,
  }) => {
    const payload = {
      penjualanID,
      akunKasID: akunKasOverride || akunKasID,
      metodePembayaranID: metodePembayaranOverride || metodePembayaranID,
      noReferensi,
      jumlahBayar,
      status,
      catatan,
    };

    if (tanggalBayar !== undefined) {
      payload.tanggalBayar = tanggalBayar;
    }

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send(payload);

    logResponse("CREATE PEMBAYARAN:", res);
    return res;
  };

  test("POST /api/pembayaran — berhasil merekam pembayaran lunas", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "001",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const akunKasSebelumRes = await getAkunKas();
    expect(akunKasSebelumRes.statusCode).toBe(200);
    const saldoSebelum = akunKasSebelumRes.body.data?.saldo ?? 0;

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-001-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
      catatan: "Tunai pas",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("status", "PAID");
    expect(res.body.data).toHaveProperty("jumlahBayar", totalTagihan);

    const penjualanRes = await getPenjualan(penjualanID);
    expect(penjualanRes.statusCode).toBe(200);
    expect(penjualanRes.body.data).toHaveProperty("statusBayar", "PAID");
    expect(penjualanRes.body.data).toHaveProperty("sisaTagihan", 0);

    const akunKasSesudahRes = await getAkunKas();
    expect(akunKasSesudahRes.statusCode).toBe(200);
    const saldoSesudah = akunKasSesudahRes.body.data?.saldo ?? 0;

    expect(saldoSesudah).toBeGreaterThanOrEqual(saldoSebelum + totalTagihan);
  });

  test("POST /api/pembayaran — berhasil menyimpan catatan pembayaran", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "002",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-002-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
      catatan: "Dibayar oleh pelanggan umum",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("catatan", "Dibayar oleh pelanggan umum");
  });

  test("GET /api/pembayaran — berhasil mengambil semua pembayaran", async () => {
    const res = await request(app)
      .get("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("GET ALL PEMBAYARAN:", res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("GET /api/pembayaran/:id — berhasil mengambil pembayaran berdasarkan ID", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "003",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const createRes = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-003-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect(createRes.statusCode).toBe(201);
    const pembayaranID = createRes.body.data?._id;
    expect(pembayaranID).toBeTruthy();

    const res = await request(app)
      .get(`/api/pembayaran/${pembayaranID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("GET PEMBAYARAN BY ID:", res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("_id", pembayaranID);
  });

  test("GET /api/pembayaran/:id — gagal karena pembayaran tidak ditemukan", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get(`/api/pembayaran/${fakeID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("GET PEMBAYARAN TIDAK DITEMUKAN:", res);

    expect([400, 404]).toContain(res.statusCode);
  });

  test("GET /api/pembayaran/:id — gagal karena format ID tidak valid", async () => {
    const res = await request(app)
      .get("/api/pembayaran/id-salah")
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("GET PEMBAYARAN ID INVALID:", res);

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — pembayaran POS PAID tanpa tanggalBayar harus gagal", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "004-POS",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-004-POS-${unique}`,
      status: "PAID",
    });

    logResponse("CREATE PEMBAYARAN POS TANPA TANGGAL:", res);

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — pembayaran INVOICE PAID tanpa tanggalBayar harus gagal", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "004-INV",
      jumlah: 2,
      jenisTransaksi: "INVOICE",
    });

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-004-INV-${unique}`,
      status: "PAID",
    });

    logResponse("CREATE PEMBAYARAN INVOICE TANPA TANGGAL:", res);

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — pembayaran INVOICE PAID dengan tanggalBayar berhasil", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "004-INV-OK",
      jumlah: 2,
      jenisTransaksi: "INVOICE",
    });

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-004-INV-OK-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    logResponse("CREATE PEMBAYARAN INVOICE DENGAN TANGGAL:", res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("status", "PAID");
    expect(res.body.data.tanggalBayar).toBeTruthy();
  });

  test("POST /api/pembayaran — gagal karena penjualanID kosong", async () => {
    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        akunKasID,
        metodePembayaranID,
        noReferensi: `PAY-TEST-005-${unique}`,
        jumlahBayar: 10000,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI PENJUALAN ID KOSONG:", res);

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — gagal karena akunKasID kosong", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "006",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        metodePembayaranID,
        noReferensi: `PAY-TEST-006-${unique}`,
        jumlahBayar: totalTagihan,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI AKUN KAS ID KOSONG:", res);

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — gagal karena metodePembayaranID kosong", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "007",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID,
        noReferensi: `PAY-TEST-007-${unique}`,
        jumlahBayar: totalTagihan,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI METODE PEMBAYARAN ID KOSONG:", res);

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — gagal karena jumlahBayar kosong", async () => {
    const { penjualanID } = await createPenjualan({
      suffix: "008",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID,
        metodePembayaranID,
        noReferensi: `PAY-TEST-008-${unique}`,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI JUMLAH BAYAR KOSONG:", res);

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — gagal karena jumlahBayar negatif", async () => {
    const { penjualanID } = await createPenjualan({
      suffix: "009",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: -1000,
      noReferensi: `PAY-TEST-009-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect(res.statusCode).toBe(400);
  });

  test("POST /api/pembayaran — jumlahBayar 0 harus ditangani konsisten", async () => {
    const { penjualanID } = await createPenjualan({
      suffix: "010",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: 0,
      noReferensi: `PAY-TEST-010-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect([400, 201]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena format penjualanID tidak valid", async () => {
    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID: "id-salah",
        akunKasID,
        metodePembayaranID,
        noReferensi: `PAY-TEST-011-${unique}`,
        jumlahBayar: 10000,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI PENJUALAN ID INVALID:", res);

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena format akunKasID tidak valid", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "012",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID: "id-salah",
        metodePembayaranID,
        noReferensi: `PAY-TEST-012-${unique}`,
        jumlahBayar: totalTagihan,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI AKUN KAS ID INVALID:", res);

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena format metodePembayaranID tidak valid", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "013",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID,
        metodePembayaranID: "id-salah",
        noReferensi: `PAY-TEST-013-${unique}`,
        jumlahBayar: totalTagihan,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
      });

    logResponse("VALIDASI METODE PEMBAYARAN ID INVALID:", res);

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena penjualanID tidak ditemukan", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();

    const res = await createPembayaran({
      penjualanID: fakeID,
      jumlahBayar: 10000,
      noReferensi: `PAY-TEST-014-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena akunKasID tidak ditemukan", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "015",
      jumlah: 2,
      jenisTransaksi: "POS",
    });
    const fakeAkunKasID = new mongoose.Types.ObjectId().toString();

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-015-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
      akunKasOverride: fakeAkunKasID,
    });

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena metodePembayaranID tidak ditemukan", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "016",
      jumlah: 2,
      jenisTransaksi: "POS",
    });
    const fakeMetodeID = new mongoose.Types.ObjectId().toString();

    const res = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-016-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
      metodePembayaranOverride: fakeMetodeID,
    });

    expect([400, 404]).toContain(res.statusCode);
  });

  test("POST /api/pembayaran — gagal karena status tidak valid", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "017",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app)
      .post("/api/pembayaran")
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        penjualanID,
        akunKasID,
        metodePembayaranID,
        noReferensi: `PAY-TEST-017-${unique}`,
        jumlahBayar: totalTagihan,
        tanggalBayar: new Date().toISOString(),
        status: "LUNAS-BGT",
      });

    logResponse("VALIDASI STATUS INVALID:", res);

    expect(res.statusCode).toBe(400);
  });

  test("PUT /api/pembayaran/:id — berhasil mengubah catatan pembayaran", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "018",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const createRes = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-018-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
      catatan: "Catatan awal",
    });

    expect(createRes.statusCode).toBe(201);
    const pembayaranID = createRes.body.data?._id;
    expect(pembayaranID).toBeTruthy();

    const res = await request(app)
      .put(`/api/pembayaran/${pembayaranID}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        jumlahBayar: totalTagihan,
        tanggalBayar: new Date().toISOString(),
        status: "PAID",
        catatan: "Catatan setelah update",
      });

    logResponse("UPDATE PEMBAYARAN:", res);

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.data).toHaveProperty("catatan", "Catatan setelah update");
  });

  test("PUT /api/pembayaran/:id — pembayaran PAID bisa diubah menjadi VOID", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "019",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const createRes = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-019-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect(createRes.statusCode).toBe(201);
    const pembayaranID = createRes.body.data?._id;

    const voidRes = await request(app)
      .put(`/api/pembayaran/${pembayaranID}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        status: "VOID",
      });

    logResponse("VOID PEMBAYARAN:", voidRes);

    expect(voidRes.statusCode).toBe(200);
    expect(voidRes.body.data).toHaveProperty("status", "VOID");

    const penjualanRes = await getPenjualan(penjualanID);
    expect(penjualanRes.statusCode).toBe(200);
    expect(penjualanRes.body.data).toHaveProperty("statusPenjualan", "DRAFT");
  });

  test("PUT /api/pembayaran/:id — pembayaran VOID tidak bisa diupdate lagi", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "020",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const createRes = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-020-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect(createRes.statusCode).toBe(201);
    const pembayaranID = createRes.body.data?._id;

    const voidRes = await request(app)
      .put(`/api/pembayaran/${pembayaranID}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        status: "VOID",
      });

    expect(voidRes.statusCode).toBe(200);

    const updateAgainRes = await request(app)
      .put(`/api/pembayaran/${pembayaranID}`)
      .set("Authorization", `Bearer ${tokenC}`)
      .send({
        catatan: "ubah lagi",
      });

    expect(updateAgainRes.statusCode).toBe(400);
  });

  test("PUT /api/pembayaran/:id — gagal tanpa token", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();

    const res = await request(app).put(`/api/pembayaran/${fakeID}`).send({
      catatan: "Tanpa token",
    });

    logResponse("UPDATE PEMBAYARAN TANPA TOKEN:", res);

    expect(res.statusCode).toBe(401);
  });

  test("DELETE /api/pembayaran/:id — berhasil menghapus pembayaran", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "021",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const createRes = await createPembayaran({
      penjualanID,
      jumlahBayar: totalTagihan,
      noReferensi: `PAY-TEST-021-${unique}`,
      status: "PAID",
      tanggalBayar: new Date().toISOString(),
    });

    expect(createRes.statusCode).toBe(201);
    const pembayaranID = createRes.body.data?._id;
    expect(pembayaranID).toBeTruthy();

    const res = await request(app)
      .delete(`/api/pembayaran/${pembayaranID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("DELETE PEMBAYARAN:", res);

    expect([200, 204]).toContain(res.statusCode);
  });

  test("DELETE /api/pembayaran/:id — gagal karena pembayaran tidak ditemukan", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/api/pembayaran/${fakeID}`)
      .set("Authorization", `Bearer ${tokenC}`);

    logResponse("DELETE PEMBAYARAN TIDAK DITEMUKAN:", res);

    expect([400, 404]).toContain(res.statusCode);
  });

  test("DELETE /api/pembayaran/:id — gagal tanpa token", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();

    const res = await request(app).delete(`/api/pembayaran/${fakeID}`);

    logResponse("DELETE PEMBAYARAN TANPA TOKEN:", res);

    expect(res.statusCode).toBe(401);
  });

  test("POST /api/pembayaran — gagal tanpa token", async () => {
    const { penjualanID, totalTagihan } = await createPenjualan({
      suffix: "022",
      jumlah: 2,
      jenisTransaksi: "POS",
    });

    const res = await request(app).post("/api/pembayaran").send({
      penjualanID,
      akunKasID,
      metodePembayaranID,
      noReferensi: `PAY-TEST-022-${unique}`,
      jumlahBayar: totalTagihan,
      tanggalBayar: new Date().toISOString(),
      status: "PAID",
    });

    logResponse("POST PEMBAYARAN TANPA TOKEN:", res);

    expect(res.statusCode).toBe(401);
  });

  test("GET /api/pembayaran — gagal tanpa token", async () => {
    const res = await request(app).get("/api/pembayaran");

    logResponse("GET ALL PEMBAYARAN TANPA TOKEN:", res);

    expect(res.statusCode).toBe(401);
  });

  test("GET /api/pembayaran/:id — gagal tanpa token", async () => {
    const fakeID = new mongoose.Types.ObjectId().toString();

    const res = await request(app).get(`/api/pembayaran/${fakeID}`);

    logResponse("GET PEMBAYARAN BY ID TANPA TOKEN:", res);

    expect(res.statusCode).toBe(401);
  });
});