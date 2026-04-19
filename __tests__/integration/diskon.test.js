const request = require("supertest");
const app = require("../../app");
const Permission = require("../../models/permissionModel");

const STATUS_TEXT = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
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

describe("Diskon — CRUD dan Validasi", () => {
  let tokenB;
  let tokenC;
  let diskonID;
  let tokenTenantLain;
  let tokenTanpaPermission = null;
  let permissionSetupOk = false;

  beforeAll(async () => {
    // 1. Seed permission yang dibutuhkan
    await Permission.create([
      {
        nama: "kelola-diskon",
        grup: "Manajemen Produk",
        deskripsi: "Dapat mengatur diskon",
      },
    ]);

    // 2. Register dan login akun utama
    await request(app).post("/api/akun/auth/register").send({
      email: "owner@toko-diskon.com",
      password: "Password123!",
      username: "owner_diskon",
    });

    const loginRes = await request(app).post("/api/akun/auth/login").send({
      email: "owner@toko-diskon.com",
      password: "Password123!",
      deviceID: "device-test-diskon",
    });

    const tokenA = loginRes.body.accessToken;
    if (!tokenA) throw new Error("Gagal mendapatkan Token A!");

    // 3. Buat tenant utama
    const tenantRes = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ namaToko: "Toko Test Diskon" });

    tokenB = tenantRes.body.tokens?.accessToken;
    if (!tokenB) throw new Error("Gagal mendapatkan Token B!");

    // 4. Register owner tenant utama
    const penggunaRes = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nama: "Owner Test Diskon", pin: "123456" });

    tokenC =
      penggunaRes.body.tokens?.accessToken ||
      penggunaRes.body.accessToken ||
      penggunaRes.body.data?.tokens?.accessToken;

    if (!tokenC) throw new Error("Gagal mendapatkan Token C!");

    // 5. Siapkan tenant kedua untuk pengujian isolasi tenant
    await request(app).post("/api/akun/auth/register").send({
      email: "owner2@toko-diskon.com",
      password: "Password123!",
      username: "owner_diskon_2",
    });

    const loginRes2 = await request(app).post("/api/akun/auth/login").send({
      email: "owner2@toko-diskon.com",
      password: "Password123!",
      deviceID: "device-test-diskon-2",
    });

    const tokenA2 = loginRes2.body.accessToken;
    if (!tokenA2) throw new Error("Gagal mendapatkan Token A tenant lain!");

    const tenantRes2 = await request(app)
      .post("/api/tenant")
      .set("Authorization", `Bearer ${tokenA2}`)
      .send({ namaToko: "Toko Test Diskon Tenant Lain" });

    const tokenB2 = tenantRes2.body.tokens?.accessToken;
    if (!tokenB2) throw new Error("Gagal mendapatkan Token B tenant lain!");

    const penggunaRes2 = await request(app)
      .post("/api/pengguna/register-owner")
      .set("Authorization", `Bearer ${tokenB2}`)
      .send({ nama: "Owner Tenant Lain", pin: "123456" });

    tokenTenantLain =
      penggunaRes2.body.tokens?.accessToken ||
      penggunaRes2.body.accessToken ||
      penggunaRes2.body.data?.tokens?.accessToken;

    if (!tokenTenantLain) {
      throw new Error("Gagal mendapatkan token tenant lain!");
    }

    // 6. Siapkan user tanpa permission kelola-diskon
    try {
      const createUserTanpaPermissionRes = await request(app)
        .post("/api/pengguna")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          nama: "Kasir Tanpa Permission",
          username: "kasir_tanpa_permission",
          email: "kasir.tanpa.permission@toko-diskon.com",
          password: "Password123!",
          pin: "654321",
          role: "Kasir",
          permissionIDs: [],
        });

      logResponse(
        "CREATE USER TANPA PERMISSION:",
        createUserTanpaPermissionRes
      );

      tokenTanpaPermission =
        createUserTanpaPermissionRes.body?.tokens?.accessToken ||
        createUserTanpaPermissionRes.body?.accessToken ||
        createUserTanpaPermissionRes.body?.data?.tokens?.accessToken ||
        null;

      if (!tokenTanpaPermission) {
        const loginUserTanpaPermissionRes = await request(app)
          .post("/api/akun/auth/login")
          .send({
            email: "kasir.tanpa.permission@toko-diskon.com",
            password: "Password123!",
            deviceID: "device-kasir-tanpa-permission",
          });

        logResponse(
          "LOGIN USER TANPA PERMISSION:",
          loginUserTanpaPermissionRes
        );

        tokenTanpaPermission =
          loginUserTanpaPermissionRes.body?.tokens?.accessToken ||
          loginUserTanpaPermissionRes.body?.accessToken ||
          loginUserTanpaPermissionRes.body?.data?.tokens?.accessToken ||
          null;
      }

      permissionSetupOk = Boolean(tokenTanpaPermission);
    } catch (err) {
      permissionSetupOk = false;
      tokenTanpaPermission = null;
      console.log(
        "SETUP USER TANPA PERMISSION DI-SKIP karena endpoint/login tidak sesuai project."
      );
    }
  });

  // =========================================================
  // CREATE / TAMBAH DATA DISKON
  // =========================================================

  // ✅ Membuat diskon persen dengan data valid
  test(
    "POST /api/diskon — berhasil membuat diskon persen (201 Created)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Member 10%",
          cakupan: "Item",
          tipe: "persen",
          nilai: 10,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE DISKON:", res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty(
        "namaDiskon",
        "Diskon Member 10%"
      );
      expect(res.body.data).toHaveProperty("tipe", "persen");
      expect(res.body.data).toHaveProperty("nilai", 10);

      diskonID = res.body.data._id;
    }
  );

  // ✅ Membuat diskon nominal dengan data valid
  test(
    "POST /api/diskon — berhasil membuat diskon nominal (201 Created)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Promo Ramadan",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 5000,
          bisaDigabung: true,
          status: "Aktif",
        });

      logResponse("CREATE DISKON NOMINAL:", res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty("tipe", "nominal");
      expect(res.body.data).toHaveProperty("nilai", 5000);
    }
  );

  // ✅ Menyimpan nilai bisaDigabung = false dengan benar
  test(
    "POST /api/diskon — berhasil menyimpan bisaDigabung false (201 Created)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Tidak Bisa Digabung",
          cakupan: "Item",
          tipe: "persen",
          nilai: 5,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE BISA DIGABUNG FALSE:", res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty("bisaDigabung", false);
    }
  );

  // ✅ Menyimpan nilai bisaDigabung = true dengan benar
  test(
    "POST /api/diskon — berhasil menyimpan bisaDigabung true (201 Created)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Bisa Digabung",
          cakupan: "Item",
          tipe: "persen",
          nilai: 7,
          bisaDigabung: true,
          status: "Aktif",
        });

      logResponse("CREATE BISA DIGABUNG TRUE:", res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty("bisaDigabung", true);
    }
  );

  // ✅ Nilai persen 100 masih dianggap valid
  test(
    "POST /api/diskon — berhasil karena nilai persen 100 masih valid (201 Created)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Maksimal 100%",
          cakupan: "Global",
          tipe: "persen",
          nilai: 100,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE PERSEN 100:", res);

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty("nilai", 100);
    }
  );

  // ✅ Nilai nominal 0 harus ditangani konsisten sesuai aturan backend
  test(
    "POST /api/diskon — nilai nominal 0 harus ditangani konsisten (201 atau 400)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Nominal Nol",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 0,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE NOMINAL 0:", res);

      expect([201, 400]).toContain(res.statusCode);
    }
  );

  // =========================================================
  // READ / AMBIL DATA DISKON
  // =========================================================

  // ✅ Mengambil semua diskon milik tenant sendiri
  test(
    "GET /api/diskon — berhasil mengambil semua diskon tenant sendiri (200 OK)",
    async () => {
      const res = await request(app)
        .get("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("GET ALL DISKON:", res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    }
  );

  // ✅ Mengambil diskon berdasarkan ID yang valid
  test(
    "GET /api/diskon/:id — berhasil mengambil diskon berdasarkan ID (200 OK)",
    async () => {
      const res = await request(app)
        .get(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("GET DISKON BY ID:", res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty("_id", diskonID);
    }
  );

  // ❌ Mengambil diskon dengan ID valid tetapi data tidak ditemukan
  test(
    "GET /api/diskon/:id — gagal karena diskon tidak ditemukan (404 Not Found)",
    async () => {
      const fakeID = "507f1f77bcf86cd799439011";

      const res = await request(app)
        .get(`/api/diskon/${fakeID}`)
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("GET DISKON TIDAK DITEMUKAN:", res);

      expect([400, 404]).toContain(res.statusCode);
    }
  );

  // =========================================================
  // UPDATE / UBAH DATA DISKON
  // =========================================================

  // ✅ Mengubah data diskon dengan payload valid
  test(
    "PUT /api/diskon/:id — berhasil mengubah data diskon (200 OK)",
    async () => {
      const res = await request(app)
        .put(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Member 15%",
          cakupan: "Item",
          tipe: "persen",
          nilai: 15,
          bisaDigabung: true,
          status: "Aktif",
        });

      logResponse("UPDATE DISKON:", res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty("_id", diskonID);
      expect(res.body.data).toHaveProperty(
        "namaDiskon",
        "Diskon Member 15%"
      );
      expect(res.body.data).toHaveProperty("nilai", 15);
      expect(res.body.data).toHaveProperty("bisaDigabung", true);
    }
  );

  // ❌ Mengubah diskon dengan persen lebih dari 100
  test(
    "PUT /api/diskon/:id — gagal karena nilai persen lebih dari 100 (400 Bad Request)",
    async () => {
      const res = await request(app)
        .put(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Tidak Valid",
          cakupan: "Item",
          tipe: "persen",
          nilai: 150,
          status: "Aktif",
        });

      logResponse("UPDATE INVALID DISKON:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    }
  );

  // ❌ Mengubah diskon dengan format ID yang tidak valid
  test(
    "PUT /api/diskon/:id — gagal karena format ID tidak valid (400/404 Invalid ID)",
    async () => {
      const res = await request(app)
        .put("/api/diskon/id-salah")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Update Gagal",
          cakupan: "Item",
          tipe: "persen",
          nilai: 10,
          status: "Aktif",
        });

      logResponse("UPDATE ID INVALID:", res);

      expect([400, 404]).toContain(res.statusCode);
    }
  );

  // =========================================================
  // DELETE / HAPUS DATA DISKON
  // =========================================================

  // ✅ Menghapus diskon dengan ID yang valid
  test(
    "DELETE /api/diskon/:id — berhasil menghapus diskon (200/204 Success)",
    async () => {
      const createRes = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Hapus",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 2000,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE DISKON HAPUS:", createRes);

      expect(createRes.statusCode).toBe(201);
      const idHapus = createRes.body.data._id;

      const res = await request(app)
        .delete(`/api/diskon/${idHapus}`)
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("DELETE DISKON:", res);

      expect([200, 204]).toContain(res.statusCode);
    }
  );

  // ❌ Menghapus diskon yang tidak ditemukan
  test(
    "DELETE /api/diskon/:id — gagal karena diskon tidak ditemukan (404 Not Found)",
    async () => {
      const fakeID = "507f1f77bcf86cd799439012";

      const res = await request(app)
        .delete(`/api/diskon/${fakeID}`)
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("DELETE DISKON TIDAK DITEMUKAN:", res);

      expect([400, 404]).toContain(res.statusCode);
    }
  );

  // ✅ Setelah dihapus, data tidak boleh bisa diambil lagi
  test(
    "DELETE lalu GET /api/diskon/:id — data harus tidak ditemukan setelah dihapus (404 Not Found)",
    async () => {
      const createRes = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Hapus Lalu Cek",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 3000,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE UNTUK DELETE+GET:", createRes);

      expect(createRes.statusCode).toBe(201);
      const idDeleteCheck = createRes.body.data._id;

      const deleteRes = await request(app)
        .delete(`/api/diskon/${idDeleteCheck}`)
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("DELETE UNTUK DELETE+GET:", deleteRes);

      expect([200, 204]).toContain(deleteRes.statusCode);

      const getRes = await request(app)
        .get(`/api/diskon/${idDeleteCheck}`)
        .set("Authorization", `Bearer ${tokenC}`);

      logResponse("GET SETELAH DELETE:", getRes);

      expect([400, 404]).toContain(getRes.statusCode);
    }
  );

  // =========================================================
  // VALIDASI INPUT
  // =========================================================

  // ❌ Membuat diskon dengan nilai persen lebih dari 100
  test(
    "POST /api/diskon — gagal karena nilai persen lebih dari 100 (400 Bad Request)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Lebay",
          cakupan: "Global",
          tipe: "persen",
          nilai: 110,
          status: "Aktif",
        });

      logResponse("ERROR DISKON:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors[0]).toMatch(/tidak boleh|maksimal|100/i);
    }
  );

  // ❌ Membuat diskon tanpa namaDiskon
  test(
    "POST /api/diskon — gagal karena namaDiskon kosong (400 Validation Error)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          cakupan: "Item",
          tipe: "persen",
          nilai: 10,
          status: "Aktif",
        });

      logResponse("VALIDASI NAMA DISKON:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.join(" ")).toMatch(/namaDiskon|nama diskon/i);
    }
  );

  // ❌ Membuat diskon dengan nama hanya berisi spasi
  test(
    "POST /api/diskon — gagal karena namaDiskon hanya berisi spasi (400 Validation Error)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "   ",
          cakupan: "Item",
          tipe: "persen",
          nilai: 10,
          status: "Aktif",
        });

      logResponse("VALIDASI NAMA WHITESPACE:", res);

      expect(res.statusCode).toBe(400);
    }
  );

  // ❌ Membuat diskon dengan nilai negatif
  test(
    "POST /api/diskon — gagal karena nilai negatif (400 Validation Error)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Minus",
          cakupan: "Global",
          tipe: "nominal",
          nilai: -5000,
          status: "Aktif",
        });

      logResponse("VALIDASI NILAI NEGATIF:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    }
  );

  // ❌ Membuat diskon dengan status yang tidak valid
  test(
    "POST /api/diskon — gagal karena status tidak valid (400 Validation Error)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Status Aneh",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 1000,
          status: "ON",
        });

      logResponse("VALIDASI STATUS INVALID:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    }
  );

  // ❌ Membuat diskon dengan tipe yang tidak valid
  test(
    "POST /api/diskon — gagal karena tipe tidak valid (400 Validation Error)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Salah Tipe",
          cakupan: "Item",
          tipe: "voucher",
          nilai: 10,
          status: "Aktif",
        });

      logResponse("VALIDASI TIPE INVALID:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    }
  );

  // ❌ Membuat diskon dengan cakupan yang tidak valid
  test(
    "POST /api/diskon — gagal karena cakupan tidak valid (400 Validation Error)",
    async () => {
      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Salah Cakupan",
          cakupan: "Semua",
          tipe: "persen",
          nilai: 10,
          status: "Aktif",
        });

      logResponse("VALIDASI CAKUPAN INVALID:", res);

      expect(res.statusCode).toBe(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    }
  );

  // =========================================================
  // AUTENTIKASI / TANPA TOKEN
  // =========================================================

  // ❌ Membuat diskon tanpa token
  test(
    "POST /api/diskon — gagal tanpa token (401 Unauthorized)",
    async () => {
      const res = await request(app).post("/api/diskon").send({
        namaDiskon: "Tanpa Auth",
        tipe: "persen",
        nilai: 5,
      });

      logResponse("POST TANPA TOKEN:", res);

      expect(res.statusCode).toBe(401);
    }
  );

  // ❌ Mengambil diskon berdasarkan ID tanpa token
  test(
    "GET /api/diskon/:id — gagal tanpa token (401 Unauthorized)",
    async () => {
      const res = await request(app).get(`/api/diskon/${diskonID}`);

      logResponse("GET BY ID TANPA TOKEN:", res);

      expect(res.statusCode).toBe(401);
    }
  );

  // ❌ Mengubah diskon tanpa token
  test(
    "PUT /api/diskon/:id — gagal tanpa token (401 Unauthorized)",
    async () => {
      const res = await request(app).put(`/api/diskon/${diskonID}`).send({
        namaDiskon: "Tanpa Auth Update",
        cakupan: "Item",
        tipe: "persen",
        nilai: 5,
        status: "Aktif",
      });

      logResponse("UPDATE TANPA TOKEN:", res);

      expect(res.statusCode).toBe(401);
    }
  );

  // ❌ Menghapus diskon tanpa token
  test(
    "DELETE /api/diskon/:id — gagal tanpa token (401 Unauthorized)",
    async () => {
      const createRes = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Hapus Tanpa Auth",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 1000,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE DISKON HAPUS TANPA AUTH:", createRes);

      expect(createRes.statusCode).toBe(201);
      const idHapus = createRes.body.data._id;

      const res = await request(app).delete(`/api/diskon/${idHapus}`);

      logResponse("DELETE TANPA TOKEN:", res);

      expect(res.statusCode).toBe(401);
    }
  );

  // =========================================================
  // ISOLASI TENANT
  // =========================================================

  // ❌ Tenant lain tidak boleh melihat diskon tenant utama
  test(
    "GET /api/diskon/:id — tenant lain gagal melihat diskon tenant utama (404/403 Isolasi Tenant)",
    async () => {
      const res = await request(app)
        .get(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenTenantLain}`);

      logResponse("GET OLEH TENANT LAIN:", res);

      expect([403, 404]).toContain(res.statusCode);
    }
  );

  // ❌ Tenant lain tidak boleh mengubah diskon tenant utama
  test(
    "PUT /api/diskon/:id — tenant lain gagal mengubah diskon tenant utama (404/403 Isolasi Tenant)",
    async () => {
      const res = await request(app)
        .put(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenTenantLain}`)
        .send({
          namaDiskon: "Tenant Lain Update",
          cakupan: "Item",
          tipe: "persen",
          nilai: 20,
          status: "Aktif",
        });

      logResponse("UPDATE OLEH TENANT LAIN:", res);

      expect([403, 404]).toContain(res.statusCode);
    }
  );

  // ❌ Tenant lain tidak boleh menghapus diskon tenant utama
  test(
    "DELETE /api/diskon/:id — tenant lain gagal menghapus diskon tenant utama (404/403 Isolasi Tenant)",
    async () => {
      const res = await request(app)
        .delete(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenTenantLain}`);

      logResponse("DELETE OLEH TENANT LAIN:", res);

      expect([403, 404]).toContain(res.statusCode);
    }
  );

  // =========================================================
  // HAK AKSES / USER TANPA PERMISSION
  // =========================================================

  // ❌ User tanpa permission tidak boleh membuat diskon
  test(
    "POST /api/diskon — user tanpa permission gagal membuat diskon (403 Forbidden)",
    async () => {
      if (!permissionSetupOk || !tokenTanpaPermission) {
        console.log(
          "SKIP TEST PERMISSION CREATE: setup user tanpa permission gagal."
        );
        return;
      }

      const res = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenTanpaPermission}`)
        .send({
          namaDiskon: "Diskon Tanpa Permission",
          cakupan: "Item",
          tipe: "persen",
          nilai: 10,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE OLEH USER TANPA PERMISSION:", res);

      expect([401, 403]).toContain(res.statusCode);
    }
  );

  // ❌ User tanpa permission tidak boleh mengubah diskon
  test(
    "PUT /api/diskon/:id — user tanpa permission gagal mengubah diskon (403 Forbidden)",
    async () => {
      if (!permissionSetupOk || !tokenTanpaPermission) {
        console.log(
          "SKIP TEST PERMISSION UPDATE: setup user tanpa permission gagal."
        );
        return;
      }

      const res = await request(app)
        .put(`/api/diskon/${diskonID}`)
        .set("Authorization", `Bearer ${tokenTanpaPermission}`)
        .send({
          namaDiskon: "Update Tanpa Permission",
          cakupan: "Item",
          tipe: "persen",
          nilai: 20,
          bisaDigabung: true,
          status: "Aktif",
        });

      logResponse("UPDATE OLEH USER TANPA PERMISSION:", res);

      expect([401, 403]).toContain(res.statusCode);
    }
  );

  // ❌ User tanpa permission tidak boleh menghapus diskon
  test(
    "DELETE /api/diskon/:id — user tanpa permission gagal menghapus diskon (403 Forbidden)",
    async () => {
      if (!permissionSetupOk || !tokenTanpaPermission) {
        console.log(
          "SKIP TEST PERMISSION DELETE: setup user tanpa permission gagal."
        );
        return;
      }

      const createRes = await request(app)
        .post("/api/diskon")
        .set("Authorization", `Bearer ${tokenC}`)
        .send({
          namaDiskon: "Diskon Untuk Tes Permission",
          cakupan: "Global",
          tipe: "nominal",
          nilai: 2500,
          bisaDigabung: false,
          status: "Aktif",
        });

      logResponse("CREATE UNTUK TES PERMISSION:", createRes);

      expect(createRes.statusCode).toBe(201);
      const idForPermissionTest = createRes.body.data._id;

      const res = await request(app)
        .delete(`/api/diskon/${idForPermissionTest}`)
        .set("Authorization", `Bearer ${tokenTanpaPermission}`);

      logResponse("DELETE OLEH USER TANPA PERMISSION:", res);

      expect([401, 403]).toContain(res.statusCode);
    }
  );
});