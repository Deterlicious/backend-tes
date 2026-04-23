const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");

const authAkun = require("../middleware/authAkun");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

/**
 * Wrapper utility untuk menangani error async
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(penggunaController, req, res, next)).catch(next);
};

// ==========================================
// 1. PUBLIC / SEMI PUBLIC
// ==========================================
router.post("/pin-refresh", wrap(penggunaController.refreshToken));

// ==========================================
// 2. LEVEL AKUN (SETUP & LOGIN SCREEN)
// ==========================================
router.post(
  "/register-owner",
  authAkun,
  wrap(penggunaController.registerOwner),
);

router.post("/pin-login", authAkun, wrap(penggunaController.loginPin));
router.get("/check-owner", authAkun, wrap(penggunaController.checkOwner));
router.post(
  "/pin-login",
  authAkun,
  wrap(penggunaController.loginPin),
);


// ==========================================
// 3. LEVEL PENGGUNA (SETELAH LOGIN PIN)
// ==========================================
router.use(authPengguna);

// Logout
router.post("/pin-logout", wrap(penggunaController.logout));

// ==========================================
// CRUD PENGGUNA (DENGAN PERMISSION)
// ==========================================

// CREATE
router.post(
  "/register-pengguna",
  checkPermission("create-pengguna"),
  wrap(penggunaController.create),
);

// READ ALL
router.get(
  "/",
  checkPermission("read-pengguna"),
  wrap(penggunaController.getAll),
);

// READ BY ID
router.get(
  "/:id",
  checkPermission("read-pengguna"),
  wrap(penggunaController.getById),
);

// UPDATE
router.put(
  "/:id",
  checkPermission("update-pengguna"),
  wrap(penggunaController.update),
);

// DELETE
router.delete(
  "/:id",
  checkPermission("delete-pengguna"),
  wrap(penggunaController.delete),
);

module.exports = router;
