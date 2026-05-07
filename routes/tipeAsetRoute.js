const express = require("express");
const router = express.Router();

const tipeAsetController = require("../controllers/tipeAsetController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Import middleware RBAC

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(tipeAsetController, req, res, next)).catch(next);

// Autentikasi wajib untuk semua rute
router.use(authPengguna);

router
  .route("/")
  // GET: Terbuka untuk semua user yang login (dibutuhkan untuk dropdown tipe aset)
  .get(wrap(tipeAsetController.getAll))
  
  // POST: Terkunci khusus untuk yang berwenang
  .post(
    checkPermission("create-tipe-aset"),
    wrap(tipeAsetController.create)
  );

router
  .route("/:id")
  // GET Detail: Terbuka untuk semua user yang login
  .get(wrap(tipeAsetController.getById))
  
  // PUT: Terkunci khusus untuk yang berwenang
  .put(
    checkPermission("update-tipe-aset"),
    wrap(tipeAsetController.update)
  )
  
  // DELETE: Terkunci khusus untuk yang berwenang
  .delete(
    checkPermission("delete-tipe-aset"),
    wrap(tipeAsetController.delete)
  );

module.exports = router;
