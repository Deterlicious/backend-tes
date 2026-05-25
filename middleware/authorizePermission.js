// const createError = require("http-errors");

// exports.checkPermission = (permissionName) => {
//   return (req, res, next) => {
//     try {
//       if (!req.pengguna) {
//         throw createError(
//           401,
//           "Akses ditolak. Gunakan Token Pengguna."
//         );
//       }

//       const permissions = req.pengguna.permissions || [];

//       // fix: Mencegah eksploitasi String.prototype.includes()
//       // Jika permissions tidak ada atau bukan Array, langsung tolak
//       if (!Array.isArray(permissions)) {
//         throw createError(403, "Akses ditolak. Format izin tidak valid.");
//       }

//       const hasPermission = permissions.includes(permissionName);

//       if (!hasPermission) {
//         throw createError(
//           403,
//           `Akses ditolak. Anda tidak memiliki izin: '${permissionName}'.`
//         );
//       }

//       next();
//     } catch (err) {
//       next(err);
//     }
//   };
// };

// versi penggabungan logika multi izin (yoga) dan security hardening (ridho)
const createError = require("http-errors");

// Menggunakan Rest Parameters milik Yoga untuk multi-izin
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

      // Hardening: Mencegah eksploitasi dan crash
      if (!Array.isArray(permissions)) {
        throw createError(403, "Akses ditolak. Format izin tidak valid.");
      }

      // Logika OR: Lolos jika memiliki minimal SATU izin yang sesuai
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