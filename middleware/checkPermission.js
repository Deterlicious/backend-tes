const createError = require("http-errors");

module.exports = (requiredPermission) => {
  return (req, res, next) => {
    // req.pengguna.permissions sudah diisi oleh authPengguna.js
    const userPermissions = req.pengguna.permissions || [];

    if (!userPermissions.includes(requiredPermission)) {
      return next(
        createError(
          403,
          `Akses ditolak. Anda tidak memiliki izin: ${requiredPermission}`,
        ),
      );
    }

    next();
  };
};
