exports.checkPermission = (permissionName) => {
  return (req, res, next) => {
    // Cek apakah yang akses adalah 'Akun' (Owner/Admin)
    // Jika request datang dari authAkun, biasanya mereka punya akses penuh (Bypass)
    if (req.akun) {
      return next(); 
    }

    // Cek apakah yang akses adalah 'Pengguna' (Staff)
    // Jika req.akun tidak ada, cek permissions milik staff
    const permissions = req.pengguna?.permissions;

    if (permissions && permissions.includes(permissionName)) {
      return next();
    } 
    
    // jika tidak ada izin yang cocok
    else {
      return res.status(403).json({
        message: `Akses ditolak. Anda tidak memiliki izin '${permissionName}'.`,
      });
    }
  };
};