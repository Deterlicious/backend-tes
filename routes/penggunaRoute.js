const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");
const authAkun = require("../middleware/authAkun");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(penggunaController, req, res, next)).catch(next);
};
router.post("/pin-refresh", wrap(penggunaController.refreshToken));

router.use(authAkun);
router.post("/pin-login", wrap(penggunaController.loginPin));
router.post("/register-owner", wrap(penggunaController.create));
router.get("/login-list/:tenantID", wrap(penggunaController.getForLoginScreen));
router.post("/pin-logout", wrap(penggunaController.logout));

// CRUD Staff (Butuh Permission 'kelola-staff')
router.post(
  "/register-staff",
  checkPermission("kelola-staff"),
  wrap(penggunaController.create)
);

router.get(
  "/staff",
  checkPermission("kelola-staff"),
  wrap(penggunaController.getAll)
);

router.get(
  "/staff/:id",
  checkPermission("kelola-staff"),
  wrap(penggunaController.getById)
);

router.put(
  "/staff/:id",
  checkPermission("kelola-staff"),
  wrap(penggunaController.update)
);

router.delete(
  "/staff/:id",
  checkPermission("kelola-staff"),
  wrap(penggunaController.delete)
);

module.exports = router;
