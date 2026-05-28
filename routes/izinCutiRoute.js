const express = require("express");
const router = express.Router();
const izinCutiController = require("../controllers/izinCutiController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(izinCutiController, req, res, next)).catch(next);
};

router.use(authPengguna);

// 1. ENDPOINT KHUSUS STAF
router
  .route("/staf")
  .get(wrap(izinCutiController.getAllOwn))
  .post(wrap(izinCutiController.createOwn));

// 2. ENDPOINT ADMIN
router
  .route("/")
  .get(checkPermission("read-izin-cuti"), wrap(izinCutiController.getAll))
  .post(checkPermission("create-izin-cuti"), wrap(izinCutiController.create));

router
  .route("/:id")
  .get(checkPermission("read-izin-cuti"), wrap(izinCutiController.getById))
  .put(checkPermission("update-izin-cuti"), wrap(izinCutiController.update));

module.exports = router;