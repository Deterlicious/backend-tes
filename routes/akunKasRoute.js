const express = require("express");
const router = express.Router();

const akunKasController = require("../controllers/akunKasController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Import dari middleware Anda yang sudah ada

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(akunKasController, req, res, next)).catch(next);

// Autentikasi wajib untuk semua rute
router.use(authPengguna);

// --- RUTE KOLEKSI ---
router
  .route("/")
  // GET: Hanya untuk staf yang memiliki izin melihat akun kas
  .get(
    checkPermission("read-akunkas"),
    wrap(akunKasController.getAll)
  )
  // POST: Hanya untuk staf yang memiliki izin membuat akun kas baru
  .post(
    checkPermission("create-akunkas"),
    wrap(akunKasController.create)
  );

// --- RUTE SPESIFIK ID ---
router
  .route("/:id")
  // GET Detail: Hanya untuk staf yang memiliki izin melihat akun kas
  .get(
    checkPermission("read-akunkas"),
    wrap(akunKasController.getById)
  )
  // PUT: Hanya untuk staf yang memiliki izin edit akun kas
  .put(
    checkPermission("update-akunkas"),
    wrap(akunKasController.update)
  )
  // DELETE: Hanya untuk staf yang memiliki izin hapus akun kas
  .delete(
    checkPermission("delete-akunkas"),
    wrap(akunKasController.delete)
  );

module.exports = router;
