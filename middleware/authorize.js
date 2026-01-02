exports.adminOnly = (req, res, next) => {
  if (req.akunContext?.roleAkun === "admin") {
    return next();
  }

  return next(
    createError(403, "Akses ditolak. Rute ini hanya untuk admin.")
  );
};
