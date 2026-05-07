const express = require("express");
const router = express.Router();

const asetController = require("../controllers/asetController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(asetController, req, res, next)).catch(next);

// Autentikasi wajib untuk semua rute
router.use(authPengguna);

router
  .route("/")
  // GET: Bebas diakses kasir untuk mengecek ketersediaan aset di layar POS/Booking
  .get(wrap(asetController.getAll))
  
  // POST: Terkunci untuk staf yang berwenang menambah aset
  .post(
    checkPermission("create-aset"), 
    wrap(asetController.create)
  );

router
  .route("/:id")
  // GET Detail: Bebas diakses pengguna yang login
  .get(wrap(asetController.getById))
  
  // PUT: Terkunci untuk staf yang berwenang mengedit/memperbaiki aset
  .put(
    checkPermission("update-aset"), 
    wrap(asetController.update)
  )
  
  // DELETE: Terkunci untuk staf yang berwenang menghapus aset
  .delete(
    checkPermission("delete-aset"), 
    wrap(asetController.delete)
  );

module.exports = router;
