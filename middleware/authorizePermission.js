const createError = require("http-errors");

exports.checkPermission = (permissionName) => {
  return (req, res, next) => {
    try {
      if (!req.pengguna) {
        throw createError(
          401,
          "Akses ditolak. Gunakan Token Pengguna."
        );
      }

      const permissions = req.pengguna.permissions || [];

      const hasPermission = permissions.includes(permissionName);

      if (!hasPermission) {
        throw createError(
          403,
          `Akses ditolak. Anda tidak memiliki izin: '${permissionName}'.`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};