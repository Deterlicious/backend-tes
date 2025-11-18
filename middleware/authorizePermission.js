exports.checkPermission = (permissionName) => {
  return (req, res, next) => {
    const permissions = req.pengguna?.permissions;

    if (permissions && permissions.includes(permissionName)) {
      next();
    } else {
      return res.status(403).json({
        message: `Akses ditolak. Anda tidak memiliki izin '${permissionName}'.`,
      });
    }
  };
};