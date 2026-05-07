const express = require("express");
const router = express.Router();

const pembayaranController = require("../controllers/pembayaranController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Tambahkan import ini

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(pembayaranController, req, res, next)).catch(next);

// Terapkan middleware auth
router.use(authPengguna);

// Rute untuk koleksi (GET All dan POST)
router
  .route("/")
  .post(
    checkPermission("create-pembayaran"),
    wrap(pembayaranController.create)
  )
  .get(
    checkPermission("read-pembayaran"),
    wrap(pembayaranController.getAll)
  );

// Rute spesifik berdasarkan ID
router
  .route("/:id")
  .get(
    checkPermission("read-pembayaran"),
    wrap(pembayaranController.getById)
  )
  .put(
    checkPermission("update-pembayaran"),
    wrap(pembayaranController.update)
  )
  .delete(
    checkPermission("delete-pembayaran"),
    wrap(pembayaranController.delete)
  );

module.exports = router;
