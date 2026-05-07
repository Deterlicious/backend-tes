const express = require("express");
const router = express.Router();

const diskonController = require("../controllers/diskonController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Import middleware permission

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(diskonController, req, res, next)).catch(next);

// Autentikasi wajib untuk semua rute
router.use(authPengguna);

// --- RUTE KOLEKSI ---
router
  .route("/")
  // GET: Bisa diakses oleh semua staf yang login (misal untuk kasir pilih diskon)
  .get(wrap(diskonController.getAll))
  
  // POST: Hanya untuk staf yang memiliki izin membuat diskon
  .post(
    checkPermission("create-diskon"), 
    wrap(diskonController.create)
  );

// --- RUTE SPESIFIK ID ---
router
  .route("/:id")
  // GET Detail: Bisa diakses semua staf yang login
  .get(wrap(diskonController.getById))
  
  // PUT: Hanya untuk staf yang memiliki izin edit diskon
  .put(
    checkPermission("update-diskon"), 
    wrap(diskonController.update)
  )
  
  // DELETE: Hanya untuk staf yang memiliki izin hapus diskon
  .delete(
    checkPermission("delete-diskon"), 
    wrap(diskonController.delete)
  );

module.exports = router;
