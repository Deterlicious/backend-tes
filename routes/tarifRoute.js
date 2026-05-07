const express = require("express");
const router = express.Router();

const tarifController = require("../controllers/tarifController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Tambahkan import RBAC

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(tarifController, req, res, next)).catch(next);

// Autentikasi wajib untuk semua rute
router.use(authPengguna);

router
  .route("/")
  // GET: Terbuka untuk semua user yang login (diperlukan POS/Kasir untuk mengecek harga)
  .get(wrap(tarifController.getAll))
  
  // POST: Dibatasi hanya untuk role dengan izin create-tarif
  .post(
    checkPermission("create-tarif"),
    wrap(tarifController.create)
  );

router
  .route("/:id")
  // GET Detail: Terbuka untuk semua user yang login
  .get(wrap(tarifController.getById))
  
  // PUT: Dibatasi hanya untuk role dengan izin update-tarif
  .put(
    checkPermission("update-tarif"),
    wrap(tarifController.update)
  )
  
  // DELETE: Dibatasi hanya untuk role dengan izin delete-tarif
  .delete(
    checkPermission("delete-tarif"),
    wrap(tarifController.delete)
  );

module.exports = router;
