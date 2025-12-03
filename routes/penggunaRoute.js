// const express = require("express");
// const router = express.Router();
// const penggunaController = require("../controllers/penggunaController");
// const authPengguna = require("../middleware/authPengguna");
// const { checkPermission } = require("../middleware/authorizePermission");

// // --- PUBLIC ---
// router.post("/pin-login", penggunaController.loginPin);
// router.post("/pin-refresh", penggunaController.refreshTokenPin);
// router.get("/login-list/:tenantID", penggunaController.getPenggunaForLoginScreen);
// router.post("/register-owner", penggunaController.createPengguna);

// // --- PRIVATE ---
// router.post("/pin-logout", authPengguna, penggunaController.logoutPin);

// // PERUBAHAN DISINI: Gunakan "kelola-staff" sesuai daftar baru Anda
// router.post(
//   "/",
//   [authPengguna, checkPermission("kelola-staff")], 
//   penggunaController.createPengguna
// );

// router.get(
//   "/",
//   [authPengguna, checkPermission("kelola-staff")], 
//   penggunaController.getAllPengguna
// );

// router.get(
//   "/:id",
//   [authPengguna, checkPermission("kelola-staff")], 
//   penggunaController.getPenggunaById
// );

// router.put(
//   "/:id",
//   [authPengguna, checkPermission("kelola-staff")], 
//   penggunaController.updatePengguna
// );

// router.delete(
//   "/:id",
//   [authPengguna, checkPermission("kelola-staff")], 
//   penggunaController.deletePengguna
// );

// module.exports = router;

const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(penggunaController, req, res, next)).catch(next);
};

// PUBLIC ROUTES (Auth)
router.post("/pin-login", wrap(penggunaController.loginPin));
router.post("/pin-refresh", wrap(penggunaController.refreshToken));
router.post("/register-owner", wrap(penggunaController.create)); // Public Register
router.get("/login-list/:tenantID", wrap(penggunaController.getForLoginScreen));

// PROTECTED ROUTES (CRUD)
router.post("/pin-logout", authPengguna, wrap(penggunaController.logout));

// CRUD Staff (Butuh Permission 'kelola-staff')
router.post("/", 
  authPengguna, 
  checkPermission("kelola-staff"), 
  wrap(penggunaController.create)
);

router.get("/", 
  authPengguna, 
  // checkPermission("kelola-staff")
  wrap(penggunaController.getAll)
);

router.get("/:id", 
  authPengguna, 
  checkPermission("kelola-staff"), 
  wrap(penggunaController.getById)
);

router.put("/:id", 
  authPengguna, 
  checkPermission("kelola-staff"), 
  wrap(penggunaController.update)
);

router.delete("/:id", 
  authPengguna, 
  checkPermission("kelola-staff"), 
  wrap(penggunaController.delete)
);

module.exports = router;