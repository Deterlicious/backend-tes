// Middleware ini HARUS dijalankan SETELAH middleware 'auth.js'
// karena ia bergantung pada 'req.user' yang dibuat oleh 'auth.js'

exports.adminOnly = (req, res, next) => {
    // 'auth' (Program 3) sudah memverifikasi token dan menaruh
    // data user (termasuk 'role') di 'req.user'
    if (req.user && req.user.role === 'admin') {
        // Jika role adalah 'admin', izinkan ke controller
        next();
    } else {
        // Jika bukan admin (atau req.user tidak ada), kirim error 403 Forbidden
        return res.status(403).json({ message: "Akses ditolak. Rute ini hanya untuk admin." });
    }
};
