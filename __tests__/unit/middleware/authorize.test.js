const { adminOnly } = require("../../../middleware/authorize");

describe("Unit Test — authorize Middleware (adminOnly)", () => {
  let req, res, next;

  beforeEach(() => {
    // Mock objek dasar Express.js
    req = {};
    res = {};
    next = jest.fn();
  });

  test("Harus melempar error 403 jika req.akunContext belum terpasang (Bypass authAkun)", () => {
    // Skenario: Developer lalai dan memasang adminOnly di rute tanpa authAkun sebelumnya
    req.akunContext = undefined; 
    
    adminOnly(req, res, next);
    
    // Harus tertahan oleh Optional Chaining (?.) dan melempar 403
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ 
      status: 403,
      message: expect.stringMatching(/hanya untuk admin/i)
    }));
  });

  test("Harus melempar error 403 jika roleAkun bukan 'admin' (Misal: 'client')", () => {
    // Skenario: User biasa mencoba masuk ke rute khusus pemilik sistem
    req.akunContext = { roleAkun: "client" };
    
    adminOnly(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ 
      status: 403 
    }));
  });

  test("Harus lolos (next tanpa error) jika role adalah 'admin'", () => {
    // Skenario: Pemilik sah (Admin) mengakses rutenya
    req.akunContext = { roleAkun: "admin" };
    
    adminOnly(req, res, next);
    
    // Fungsi next() harus dipanggil bersih tanpa disisipi pesan error
    expect(next).toHaveBeenCalledWith(); 
  });
});