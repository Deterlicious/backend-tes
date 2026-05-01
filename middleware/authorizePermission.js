const createError = require("http-errors");

exports.checkPermission = (...allowedPermissions) => {
  return (req, res, next) => {
    try {
      if (!req.pengguna) {
        throw createError(
          401,
          "Akses ditolak. Gunakan Token Pengguna."
        );
      }

      const permissions = req.pengguna.permissions || [];

      // Mengizinkan jika user memiliki SALAH SATU dari permission yang disyaratkan
      const hasPermission = allowedPermissions.some(p => permissions.includes(p));

      if (!hasPermission) {
        throw createError(
          403,
          `Akses ditolak. Anda tidak memiliki salah satu dari izin berikut: ${allowedPermissions.join(', ')}.`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};