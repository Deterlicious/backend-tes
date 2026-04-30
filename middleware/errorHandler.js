module.exports = (err, req, res, next) => {
  // 1. Tentukan status dasar TERLEBIH DAHULU
  let status = err.status || 500;
  let message = err.message || "Terjadi kesalahan internal pada server.";
  let errors = err.errors || null;

  // 2. Evaluasi log MENGGUNAKAN variabel 'status' yang sudah distandarisasi
  if (status === 500 || process.env.NODE_ENV === "development") {
    console.error("Critical Error Log:", {
      name: err.name,
      message: err.message, // Catat pesan asli, bukan yang disamarkan ke klien
      stack: process.env.NODE_ENV === "development" ? err.stack : "HIDDEN",
    });
  }

  // ==========================================
  // 1. MONGOOSE VALIDATION ERROR
  // ==========================================
  if (err.name === "ValidationError") {
    status = 400;
    message = "Data yang dikirim tidak valid.";
    errors = Object.values(err.errors).map((el) => el.message);
  }

  // ==========================================
  // 2. MONGODB DUPLICATE KEY (11000)
  // ==========================================
  if (err.code === 11000) {
    status = 400;
    const key = Object.keys(err.keyValue || {})[0];
    const fieldMapping = {
      email: "Alamat email",
      username: "Nama pengguna",
      nomorTelepon: "Nomor telepon",
      namaRole: "Nama role",
      namaProduk: "Nama produk"
    };
    const fieldName = fieldMapping[key] || key;
    message = `${fieldName} sudah terdaftar dalam sistem. Gunakan yang lain.`;
  }

  // ==========================================
  // 3. JWT & SYNTAX ERROR
  // ==========================================
  if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Token tidak valid atau telah dimanipulasi.";
  }

  if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Sesi telah berakhir. Silakan login kembali.";
  }

  // FIX: Gunakan if-else dan cek err.message asli untuk menghindari Cascade Mutation
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    status = 400;
    message = "Format JSON yang dikirim tidak valid.";
  } else if (err.name === "SyntaxError" && err.message.includes("JSON")) {
    status = 500;
    message = "Terjadi kegagalan sinkronisasi data (Internal Data Corruption).";
  }

  // ==========================================
  // 4. MONGOSE CAST ERROR
  // ==========================================
  if (err.name === "CastError") {
    status = 404;
    message = `Resource dengan ID '${err.value}' tidak ditemukan atau format ID salah.`;
  }

  // Kirim respons akhir
  res.status(status).json({
    status: "error",
    message,
    ...(errors && { errors }),
  });
};