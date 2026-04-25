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

// rute khusus akun sebelum ada pengguna
router.use("/owner", authAkun);
// router.post("/owner/create-tenant", wrap(tenantController.create));

// route admin pakai authAkun (bukan authPengguna) karena adminOnly cek req.akunContext yang hanya diisi oleh authAkun
router.get("/admin/all", authAkun, adminOnly, wrap(akunController.getAllAkun));

router.delete(
  "/admin/users/:id",
  authAkun,
  adminOnly,
  wrap(akunController.deleteUserByAdmin),
);

// manajemen perangkat
router.use("/device-akun", authAkun);

router.get("/device-akun", wrap(akunController.getDevice));
router.post("/device-akun/add", wrap(akunController.addDevice));
router.put("/device-akun/promote", wrap(akunController.promoteDevice));
router.put("/device-akun/demote", wrap(akunController.demoteDevice));
router.delete("/device-akun/remove", wrap(akunController.removeDevice));
router.get("/device-akun/history", wrap(akunController.getDeviceHistory));

// RBA + permission
// router.use(authPengguna) dipindah ke bawah agar route admin di atas tidak ikut terkena authPengguna
router.use(authPengguna);
router.get(
  "/akun",
  checkPermission("read-akun"),
  wrap(akunController.getProfile),
);

router.put(
  "/akun",
  checkPermission("update-akun"),
  wrap(akunController.updateProfile),
);

module.exports = router;
