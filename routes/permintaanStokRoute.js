const express = require("express");
const router = express.Router();
const permintaanStokController = require("../controllers/permintaanStokController");
const authPengguna = require("../middleware/authPengguna");

// 1. Import middleware authorizePermission
// Sesuaikan path jika letaknya berbeda, dan pastikan destructuring { checkPermission } benar
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Middleware authPengguna tetap di atas karena checkPermission butuh req.pengguna
router.use(authPengguna);

// --- ROUTES DENGAN PROTEKSI ---

// Melihat daftar permintaan (Staff, Manager, Gudang biasanya boleh)
router.get(
  "/",
  checkPermission("read-permintaan-stok"),
  wrap(permintaanStokController.getAllPermintaanStok),
);

// Membuat draft (Biasanya hanya Staff Outlet)
router.post(
  "/",
  checkPermission("create-permintaan-stok"),
  wrap(permintaanStokController.createPermintaanStok),
);

// Update isi barang
router.put(
  "/:id",
  checkPermission("update-permintaan-stok"),
  wrap(permintaanStokController.updatePermintaanStok),
);

// Mengajukan permintaan (Submit)
router.patch(
  "/:id/submit",
  checkPermission("update-permintaan-stok"),
  wrap(permintaanStokController.submitRequest),
);

// MENYETUJUI (Khusus Manager)
router.patch(
  "/:id/approve",
  checkPermission("approve-permintaan-stok"),
  wrap(permintaanStokController.approveRequest),
);

// MENOLAK (Khusus Manager)
router.patch(
  "/:id/reject",
  checkPermission("reject-permintaan-stok"),
  wrap(permintaanStokController.rejectRequest),
);

module.exports = router;
