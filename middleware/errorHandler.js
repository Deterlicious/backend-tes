module.exports = (err, req, res, next) => {
  console.error("Error Log:", err);

  let status = err.status || 500;
  let message = err.message || "Terjadi kesalahan internal pada server.";
  let errors = err.errors || null;

  // ==========================================
  // VALIDATION ERROR
  // ==========================================
  if (err.name === "ValidationError") {
    status = 400;
    message = "Data yang dikirim tidak valid.";
    errors = Object.values(err.errors).map((el) => el.message);
  }

  // ==========================================
  // DUPLICATE KEY ERROR (FIXED)
  // ==========================================
  if (err.code === 11000) {
    status = 400;

    const duplicatedFields = Object.keys(err.keyValue || {});

    const readableField = duplicatedFields.includes("namaRole")
      ? "namaRole"
      : duplicatedFields[0];

    message = `Data '${readableField}' sudah digunakan. Harap gunakan yang lain.`;
  }

  // ==========================================
  // JWT ERROR
  // ==========================================
  if (err.name === "JsonWebTokenError") {
    status = 401;
    message = "Token tidak valid.";
  }

  if (err.name === "TokenExpiredError") {
    status = 401;
    message = "Sesi telah berakhir.";
  }

  // ==========================================
  // CAST ERROR
  // ==========================================
  if (err.name === "CastError") {
    status = 404;
    message = "Resource tidak ditemukan (ID Invalid).";
  }

  res.status(status).json({
    message,
    errors,
  });
};
