const express = require("express");
const router = express.Router();

const metodePembayaranController = require("../controllers/metodePembayaranController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(metodePembayaranController, req, res, next)).catch(
    next,
  );

// Otentikasi pengguna tetap wajib untuk semua rute
router.use(authPengguna);

// --- RUTE KOLEKSI ---

// GET: Bisa diakses semua staf yang login (Tanpa permission)
router.get("/", wrap(metodePembayaranController.getAll));

// POST: Hanya yang punya izin create
router.post(
  "/",
  checkPermission("create-metode-pembayaran"),
  wrap(metodePembayaranController.create),
);

// --- RUTE SPESIFIK ID ---

router
  .route("/:id")
  // GET Detail: Bisa diakses semua staf (Tanpa permission)
  .get(wrap(metodePembayaranController.getById))

  // PUT: Perlu izin update
  .put(
    checkPermission("update-metode-pembayaran"),
    wrap(metodePembayaranController.update),
  )

  // DELETE: Perlu izin delete
  .delete(
    checkPermission("delete-metode-pembayaran"),
    wrap(metodePembayaranController.delete),
  );

module.exports = router;
