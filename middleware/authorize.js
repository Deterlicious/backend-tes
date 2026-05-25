const createError = require("http-errors");

exports.adminOnly = (req, res, next) => {
  // ✅ FIX: authAkun isi req.akunContext, bukan req.pengguna
  // Route yang pakai adminOnly WAJIB pakai authAkun sebelumnya, bukan authPengguna
  if (req.akunContext?.roleAkun === "admin") {
    return next();
  }
  return next(
    createError(403, "Akses ditolak. Rute ini hanya untuk admin.")
  );
};