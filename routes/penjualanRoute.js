const express = require("express");
const router = express.Router();

const penjualanController = require("../controllers/penjualanController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Tambahkan import ini

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(penjualanController, req, res, next)).catch(next);

// Terapkan middleware otentikasi wajib
router.use(authPengguna);

router
  .route("/")
  .post(
    checkPermission("create-penjualan"), 
    wrap(penjualanController.create)
  )
  .get(
    checkPermission("read-penjualan"), 
    wrap(penjualanController.getAll)
  );

router
  .route("/:id")
  .get(
    checkPermission("read-penjualan"), 
    wrap(penjualanController.getById)
  )
  .put(
    checkPermission("update-penjualan"), 
    wrap(penjualanController.update)
  )
  .delete(
    checkPermission("delete-penjualan"), 
    wrap(penjualanController.delete)
  );

module.exports = router;
