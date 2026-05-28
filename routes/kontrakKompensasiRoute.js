const express = require("express");
const router = express.Router();
const kontrakController = require("../controllers/kontrakKompensasiController");
const authPengguna = require("../middleware/authPengguna");

// 1. Import middleware permission
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kontrakController, req, res, next)).catch(next);
};

// Autentikasi wajib untuk semua rute di bawahnya
router.use(authPengguna);

router
  .route("/")
  // GET: Hanya untuk staf yang memiliki izin melihat kontrak
  .get(
    checkPermission("read-kontrak-kompensasi"),
    wrap(kontrakController.getAll),
  )

  // POST: Hanya untuk staf yang memiliki izin membuat kontrak
  .post(
    checkPermission("create-kontrak-kompensasi"),
    wrap(kontrakController.create),
  );

router
  .route("/:id")
  // GET: Hanya untuk staf yang memiliki izin melihat kontrak
  .get(
    checkPermission("read-kontrak-kompensasi"),
    wrap(kontrakController.getById),
  )

  // PUT: Hanya untuk staf yang memiliki izin edit kontrak
  .put(
    checkPermission("update-kontrak-kompensasi"),
    wrap(kontrakController.update),
  )

  // DELETE: Hanya untuk staf yang memiliki izin hapus kontrak
  .delete(
    checkPermission("delete-kontrak-kompensasi"),
    wrap(kontrakController.delete),
  );

module.exports = router;
