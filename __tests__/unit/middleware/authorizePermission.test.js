const { checkPermission } = require("../../../middleware/authorizePermission");

describe("Unit Test — authorizePermission Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
  });

  test("Harus melempar error 401 jika req.pengguna tidak terdefinisi", () => {
    // Skenario: Middleware authPengguna belum dijalankan atau gagal
    const middleware = checkPermission("akses-pos");
    req.pengguna = undefined;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Gunakan Token Pengguna/i),
      }),
    );
  });

  test("Harus melempar error 403 jika daftar permissions kosong", () => {
    // Skenario: Pengguna memiliki akun tapi tidak memiliki izin sama sekali
    const middleware = checkPermission("delete-tenant");
    req.pengguna = { permissions: [] };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/salah satu dari izin berikut/i),
      }),
    );
  });

  test("Harus melempar error 403 jika izin yang diminta tidak ada dalam daftar", () => {
    // Skenario: Kasir mencoba akses rute laporan (laporan-penjualan)
    const middleware = checkPermission("laporan-penjualan");
    req.pengguna = {
      permissions: ["akses-pos", "read-inventory"],
    };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/laporan-penjualan/i),
      }),
    );
  });

  test("Harus lolos (next tanpa error) jika pengguna memiliki izin yang sesuai", () => {
    // Skenario: Kasir mengakses rute transaksi (akses-pos)
    const middleware = checkPermission("akses-pos");
    req.pengguna = {
      permissions: ["akses-pos", "read-inventory"],
    };

    middleware(req, res, next);

    // Harus tembus tanpa pesan kesalahan
    expect(next).toHaveBeenCalledWith();
  });

  test("Defensif: Harus tetap melempar 403 jika properti permissions bukan array (Mencegah Crash)", () => {
    // Skenario: Data di req.pengguna rusak (misal permissions berisi string atau null)
    const middleware = checkPermission("akses-pos");
    req.pengguna = { permissions: "akses-pos" }; // Harusnya array

    middleware(req, res, next);

    // Memastikan perisai mutlak Anda bekerja
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/Format izin tidak valid/i),
      }),
    );
  });

  test("Sinergi Tim: Harus lolos jika meminta BANYAK izin dan pengguna punya SALAH SATUNYA", () => {
    // Membutuhkan "delete-tenant" ATAU "read-tenant"
    const middleware = checkPermission("delete-tenant", "read-tenant");
    req.pengguna = {
      permissions: ["read-tenant", "akses-pos"],
    };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(); // Lolos karena punya "read-tenant"
  });

  test("Defensif: Harus fallback ke array kosong dan melempar 403 jika properti permissions tidak ada", () => {
    const middleware = checkPermission("read-tenant");
    req.pengguna = {}; // Objek pengguna ada, tapi properti permissions lenyap
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/salah satu dari izin berikut/i),
      })
    );
  });
});
