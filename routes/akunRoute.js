const express = require("express");
const router = express.Router();
const akunController = require("../controllers/akunController");

// Middleware
const authAkun = require("../middleware/authAkun"); // untuk fase awal (owner sebelum jadi pengguna)
const authPengguna = require("../middleware/authPengguna"); // untuk RBAC
const { adminOnly } = require("../middleware/authorize");
const { checkPermission } = require("../middleware/authorizePermission");

// rate limiter untuk login, matikan atau jadikan komentar jika ingin test cepat, WAJIB DIKEMBALIKAN SETELAH TEST
const rateLimit = require("express-rate-limit");
const limitMinutes = process.env.LOGIN_LIMIT_MINUTES;
const maxAttempts = process.env.LOGIN_MAX_ATTEMPTS;
const loginLimiter = rateLimit({
  windowMs: limitMinutes * 60 * 1000,
  max: maxAttempts, // max percobaan login
  message: { message: `Terlalu banyak percobaan login, coba lagi dalam ${limitMinutes} menit` }
});

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(akunController, req, res, next)).catch(next);
};

// ==========================================
// ✅ RUTE PUBLIK (TANPA TOKEN)
// ==========================================
router.post("/auth/register", wrap(akunController.register));
router.post("/auth/login", loginLimiter, wrap(akunController.login)); // login dibatasi dengan rate limiter
router.post("/auth/refreshtoken", wrap(akunController.refreshToken));
router.post("/auth/logout", wrap(akunController.logout));


// ==========================================
// ✅ RUTE KHUSUS AKUN (SEBELUM ADA PENGGUNA)
// ==========================================
// Digunakan setelah login awal untuk setup tenant
router.use("/owner", authAkun);

// Contoh (kalau nanti ada)
// router.post("/owner/create-tenant", wrap(tenantController.create));


// ==========================================
// ✅ RUTE BERBASIS PENGGUNA (RBAC + PERMISSION)
// ==========================================
// Semua route di bawah ini pakai authPengguna
router.use(authPengguna);


// ==========================================
// 🔐 AKUN (BERBASIS PERMISSION)
// ==========================================
router.get(
  "/akun",
  checkPermission("read-akun"),
  wrap(akunController.getProfile)
);

router.put(
  "/akun",
  checkPermission("update-akun"),
  wrap(akunController.updateProfile)
);


// ==========================================
// 👑 ADMIN SYSTEM (LEVEL SAAS)
// ==========================================
router.get(
  "/admin/all",
  adminOnly,
  wrap(akunController.getAllAkun)
);

router.delete(
  "/admin/users/:id",
  adminOnly,
  wrap(akunController.deleteUserByAdmin)
);


// ==========================================
// 📱 MANAJEMEN PERANGKAT (MASIH VIA AKUN)
// ==========================================
// NOTE: ini tetap pakai akun, jadi kita pakai route khusus
router.use("/device-akun", authAkun);

router.get("/device-akun", wrap(akunController.getDevice));
router.post("/device-akun/add", wrap(akunController.addDevice));
router.put("/device-akun/promote", wrap(akunController.promoteDevice));
router.put("/device-akun/demote", wrap(akunController.demoteDevice));
router.delete("/device-akun/remove", wrap(akunController.removeDevice));
router.get("/device-akun/history", wrap(akunController.getDeviceHistory));


module.exports = router;