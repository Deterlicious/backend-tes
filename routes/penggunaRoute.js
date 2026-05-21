const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");
const authAkun = require("../middleware/authAkun");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");
const createError = require("http-errors");
const { validatePenggunaLogin } = require("../validators/penggunaValidator");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(penggunaController, req, res, next)).catch(next);
};

// middleware untuk validasi login pengguna
const validateLoginRequest = (req, res, next) => {
  const validation = validatePenggunaLogin(req.body);
  if (!validation.valid) {
    // Lemparkan error 400 Bad Request ke global error handler
    return next(createError(400, validation.errors[0]));
  }
  next();
};

// 1. public / semi public routes (tanpa authPengguna, tapi tetap validasi akun)
router.post("/pin-refresh", wrap(penggunaController.refreshToken));

// 2. level akun (setup & login screen)
router.post(
  "/register-owner",
  authAkun,
  wrap(penggunaController.registerOwner),
);
router.post(
  "/pin-login",
  authAkun,
  validateLoginRequest,
  wrap(penggunaController.loginPin),
);
router.get("/check-owner", authAkun, wrap(penggunaController.checkOwner));

// 3. level pengguna (setelah login pin)

router.use(authPengguna);

// Logout
router.post("/pin-logout", wrap(penggunaController.logout));

// CRUD pengguna (pakai permission "pengguna" untuk semua operasi, karena ini terkait manajemen pengguna)
router.post(
  "/register-pengguna",
  checkPermission("create-pengguna"),
  wrap(penggunaController.create),
);

router.get(
  "/",
  checkPermission("read-pengguna"),
  wrap(penggunaController.getAll),
);

router.get(
  "/:id",
  checkPermission("read-pengguna"),
  wrap(penggunaController.getById),
);

router.put(
  "/:id",
  // checkPermission("update-pengguna"),
  wrap(penggunaController.update),
);

router.delete(
  "/:id",
  checkPermission("delete-pengguna"),
  wrap(penggunaController.delete),
);

// Device Management (pindahan dari akunRoute) - pakai permission "update-pengguna" karena ini bagian dari manajemen pengguna

// Semua route device pakai permission "update-pengguna"
// karena hanya Owner/Manager yang boleh kelola device staff
router.post(
  "/:id/device/add",
  checkPermission("update-pengguna"),
  wrap(penggunaController.addDevice),
);

router.put(
  "/:id/device/promote",
  checkPermission("update-pengguna"),
  wrap(penggunaController.promoteDevice),
);

router.put(
  "/:id/device/demote",
  checkPermission("update-pengguna"),
  wrap(penggunaController.demoteDevice),
);

router.delete(
  "/:id/device/remove",
  checkPermission("update-pengguna"),
  wrap(penggunaController.removeDevice),
);

router.get(
  "/:id/device/history",
  checkPermission("read-pengguna"),
  wrap(penggunaController.getDeviceHistory),
);

module.exports = router;
