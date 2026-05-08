const errorHandler = require("../../../middleware/errorHandler");

describe("Unit Test Middleware — errorHandler", () => {
  let err, req, res, next;

  beforeEach(() => {
    // Membungkam console.error agar terminal pengujian Anda tetap bersih
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Mocking objek Express dasar
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Default error object
    err = new Error("Default error message");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Skenario 1 — Menangani Error Default (500 Internal Server Error)", () => {
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        message: "Default error message",
      }),
    );
    // console.error harus dipanggil untuk error 500
    expect(console.error).toHaveBeenCalled();
  });

  test("Skenario 2 — Menangani Error Operasional yang dilempar dengan status spesifik (Misal: 403)", () => {
    err.status = 403;
    err.message = "Akses ditolak khusus.";

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Akses ditolak khusus.",
      }),
    );
  });

  test("Skenario 3 — Menangani Mongoose ValidationError (400)", () => {
    err.name = "ValidationError";
    err.errors = {
      nama: { message: "Nama wajib diisi." },
      harga: { message: "Harga tidak boleh negatif." },
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Data yang dikirim tidak valid.",
        errors: ["Nama wajib diisi.", "Harga tidak boleh negatif."],
      }),
    );
  });

  test("Skenario 4 — Menangani MongoDB Duplicate Key Error (11000) dengan Mapping", () => {
    err.code = 11000;
    err.keyValue = { email: "test@domain.com" }; // Simulasi email duplikat

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Alamat email sudah terdaftar/i),
      }),
    );
  });

  test("Skenario 5 — Menangani Token Manipulasi (JsonWebTokenError - 401)", () => {
    err.name = "JsonWebTokenError";

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Token tidak valid/i),
      }),
    );
  });

  test("Skenario 6 — Menangani Token Kedaluwarsa (TokenExpiredError - 401)", () => {
    err.name = "TokenExpiredError";

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Sesi telah berakhir/i),
      }),
    );
  });

  test("Skenario 7 — Menangani Payload Klien Korup (SyntaxError Express Body - 400)", () => {
    // Simulasi error dari express.json() saat menerima body yang rusak
    const syntaxErr = new SyntaxError("Unexpected string in JSON");
    syntaxErr.status = 400;
    syntaxErr.body = "{ bad json }";

    errorHandler(syntaxErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Format JSON yang dikirim tidak valid/i),
      }),
    );
  });

  test("Skenario 8 — Menangani Data Cache Redis Korup (SyntaxError Internal - 500)", () => {
    // Simulasi JSON.parse() gagal di dalam authPengguna (dari redis)
    const syntaxErr = new SyntaxError(
      "Unexpected token o in JSON at position 1",
    );
    // Message otomatis bawaan Node.js mengandung kata "JSON"

    errorHandler(syntaxErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/Kegagalan sinkronisasi data/i),
      }),
    );
  });

  test("Skenario 9 — Menangani Mongoose CastError (ID Invalid - 404)", () => {
    err.name = "CastError";
    err.value = "123x"; // ID abal-abal

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/123x/i),
      }),
    );
  });

  test("Skenario 10 [DEFENSIF] — Menyembunyikan console.error di mode produksi untuk error ringan (400)", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    err.status = 400; // Error operasional biasa, bukan fatal

    errorHandler(err, req, res, next);

    // Di production, error ringan tidak boleh mencemari log server
    expect(console.error).not.toHaveBeenCalled();

    // Kembalikan environment
    process.env.NODE_ENV = originalEnv;
  });

  test("Skenario 11 [SECURITY] — Menyamarkan pesan teknis (Data Leak) pada Error 500 di mode Production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    // Simulasi error teknis dari Node.js (misal: variabel tidak ditemukan)
    const fatalErr = new ReferenceError("variabel_rahasia_db is not defined");

    errorHandler(fatalErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    // Pesan harus diubah menjadi generik, bukan "variabel_rahasia_db is not defined"
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Terjadi kesalahan internal pada server.",
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });

  test("Skenario 12 [DEBUG] — Menampilkan pesan teknis asli pada Error 500 di mode Development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const fatalErr = new TypeError(
      "Cannot read properties of undefined (reading 'password')",
    );

    errorHandler(fatalErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    // Pesan asli HARUS dikirim ke klien untuk mempermudah debugging oleh Frontend
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Cannot read properties of undefined (reading 'password')",
      }),
    );

    process.env.NODE_ENV = originalEnv;
  });

  test("Skenario 13 [EDGE CASE] — Menangani Duplicate Key (11000) jika nama field tidak ada di fieldMapping", () => {
    err.code = 11000;
    err.keyValue = { kodeVoucherRahasia: "DISKON50" }; // Field yang tidak ada di daftar mapping

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    // Harus menggunakan nama key asli ("kodeVoucherRahasia") sebagai fallback
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/kodeVoucherRahasia sudah terdaftar/i),
      }),
    );
  });

  test("Skenario 14 [EDGE CASE] — Menangani Duplicate Key (11000) dengan aman jika err.keyValue undefined (Data Korup)", () => {
    err.code = 11000;
    err.keyValue = undefined; // Simulasi kegagalan driver MongoDB mengirim keyValue

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    // Harus aman (tidak crash karena Object.keys(undefined)) dan mengembalikan nilai fallback yang tidak terdefinisi ('undefined')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/sudah terdaftar/i),
      }),
    );
  });

  test("Skenario 15 [EXPRESS FATAL] — Mendelegasikan ke default handler jika response headers sudah terkirim (headersSent = true)", () => {
    res.headersSent = true; // Simulasi respons sudah mulai dikirim (misal: streaming putus)

    errorHandler(err, req, res, next);

    // Verifikasi: Middleware HARUS menyerah dan memanggil next(err)
    expect(next).toHaveBeenCalledWith(err);
    // Verifikasi: Tidak boleh mencoba mengirim response lagi
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("Skenario 16 [OPERATIONAL] — Mengembalikan array 'errors' custom dari validasi non-Mongoose", () => {
    // Simulasi error yang dilempar dari Joi / Validator buatan Tuan sendiri
    err.status = 422;
    err.message = "Validasi Input Gagal";
    err.errors = ["Format email tidak valid", "PIN harus berupa angka"];

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        message: "Validasi Input Gagal",
        errors: ["Format email tidak valid", "PIN harus berupa angka"],
      }),
    );
  });
});
