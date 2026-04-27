const express = require("express");
const router = express.Router();
const akunController = require("../controllers/akunController");

// Middleware
const authAkun = require("../middleware/authAkun");
const authPengguna = require("../middleware/authPengguna");
const { adminOnly } = require("../middleware/authorize");
const { checkPermission } = require("../middleware/authorizePermission");

// rate limiter untuk login, matikan atau jadikan komentar jika ingin test cepat, WAJIB DIKEMBALIKAN SETELAH TEST
// const rateLimit = require("express-rate-limit");
// const limitMinutes = process.env.LOGIN_LIMIT_MINUTES;
// const maxAttempts = process.env.LOGIN_MAX_ATTEMPTS;
// const loginLimiter = rateLimit({
//   windowMs: limitMinutes * 60 * 1000,
//   max: maxAttempts,
//   message: { message: `Terlalu banyak percobaan login, coba lagi dalam ${limitMinutes} menit` }
// });

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(akunController, req, res, next)).catch(next);
};

// rute publik (tanpa token)
router.post("/auth/register", wrap(akunController.register));
router.post("/auth/login", wrap(akunController.login)); // login dibatasi dengan rate limiter
router.post("/auth/refreshtoken", wrap(akunController.refreshToken));
router.post("/auth/logout", wrap(akunController.logout));

// rute khusus owner
router.use("/owner", authAkun);
// router.post("/owner/create-tenant", wrap(tenantController.create));

// admin sistem (level saas)

router.get(
  "/admin/all",
  authAkun,
  adminOnly,
  wrap(akunController.getAllAkun)
);

router.delete(
  "/admin/users/:id",
  authAkun,
  adminOnly,
  wrap(akunController.deleteUserByAdmin)
);

// rute berbasis pengguna (RBAC + PERMISSION)
// router.use(authPengguna) dipindah ke bawah agar route admin
// di atas tidak ikut terkena authPengguna
router.use(authPengguna);

// akun (pakai permission)
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

module.exports = router;