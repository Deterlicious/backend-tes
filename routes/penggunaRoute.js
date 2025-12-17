const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");
const authAkun = require("../middleware/authAkun");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(penggunaController, req, res, next)).catch(next);
};

router.use(authAkun); // Proteksi global: semua route butuh token akun

router.post("/pin-login", wrap(penggunaController.loginPin));
router.post("/pin-refresh", wrap(penggunaController.refreshToken));
router.post("/register-owner", wrap(penggunaController.create)); // Public Register
router.get("/login-list/:tenantID", wrap(penggunaController.getForLoginScreen));
router.post("/pin-logout", wrap(penggunaController.logout));

// CRUD Staff (Butuh Permission 'kelola-staff')
router.post(
  "/",
  checkPermission("kelola-staff"),
  wrap(penggunaController.create)
);

router.get(
  "/",
  checkPermission("kelola-staff"),
  wrap(penggunaController.getAll)
);

router.get(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(penggunaController.getById)
);

router.put(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(penggunaController.update)
);

router.delete(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(penggunaController.delete)
);

module.exports = router;
