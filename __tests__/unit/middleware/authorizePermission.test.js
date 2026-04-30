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
    const middleware = checkPermission("TAMBAH_PESANAN");
    req.pengguna = undefined;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        message: expect.stringMatching(/Gunakan Token Pengguna/i),
      })
    );
  });

  test("Harus melempar error 403 jika daftar permissions kosong", () => {
    // Skenario: Pengguna memiliki akun tapi tidak memiliki izin sama sekali
    const middleware = checkPermission("HAPUS_PESANAN");
    req.pengguna = { permissions: [] };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/'HAPUS_PESANAN'/i),
      })
    );
  });

  test("Harus melempar error 403 jika izin yang diminta tidak ada dalam daftar", () => {
    // Skenario: Kasir mencoba akses rute 'LAPORAN_KEUANGAN'
    const middleware = checkPermission("LAPORAN_KEUANGAN");
    req.pengguna = {
      permissions: ["TAMBAH_PESANAN", "LIHAT_MENU"],
    };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 403,
        message: expect.stringMatching(/'LAPORAN_KEUANGAN'/i),
      })
    );
  });

  test("Harus lolos (next tanpa error) jika pengguna memiliki izin yang sesuai", () => {
    // Skenario: Kasir mengakses rute 'TAMBAH_PESANAN'
    const middleware = checkPermission("TAMBAH_PESANAN");
    req.pengguna = {
      permissions: ["TAMBAH_PESANAN", "LIHAT_MENU"],
    };

    middleware(req, res, next);

    // Harus tembus tanpa pesan kesalahan
    expect(next).toHaveBeenCalledWith();
  });

  test("Defensif: Harus tetap melempar 403 jika properti permissions bukan array (Mencegah Crash)", () => {
    // Skenario: Data di req.pengguna rusak (misal permissions berisi string atau null)
    const middleware = checkPermission("AKSES_APLIKASI");
    req.pengguna = { permissions: "AKSES_APLIKASI" }; // Harusnya array

    middleware(req, res, next);

    // Karena .includes() hanya bekerja pada array, middleware harus menangani ini di blok catch
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});