module.exports = (err, req, res, next) => {
  console.error("Error Log:", err);

  // Default Status & Message
  let status = err.status || 500;
  let message = err.message || "Terjadi kesalahan internal pada server.";
  let errors = null;


  // Error Validasi Mongoose (Misal: Email required, Min length)
  if (err.name === "ValidationError") {
    status = 400;
    message = "Data yang dikirim tidak valid.";
    // Ambil detail error per field
    errors = Object.values(err.errors).map((el) => el.message);
  }

  // Error Duplikat Data (Misal: Email sudah terdaftar / Unique Index)
  if (err.code === 11000) {
    status = 400;
    // Ekstrak nama field yang duplikat
    const field = Object.keys(err.keyValue)[0];
    message = `Data '${field}' sudah digunakan. Harap gunakan yang lain.`;
  }

  // Error JWT (Jika lolos dari middleware auth)
  if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Token tidak valid.";
  }
  if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Sesi telah berakhir.";
  }

  // Error CastID (ID di URL tidak valid format MongoDB)
  if (err.name === "CastError") {
    status = 404; // Anggap not found jika ID ngawur
    message = "Resource tidak ditemukan (ID Invalid).";
  }

  // Kirim Response Rapi
  res.status(status).json({
    message: message,
    errors: errors, // Detail error (opsional, ada jika validasi gagal)
  });
};