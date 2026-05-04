const express = require("express");
const router = express.Router();
const pengajuanStokController = require("../controllers/pengajuanStokController");
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
  checkPermission("read-pengajuan-stok"),
  wrap(pengajuanStokController.getAllPengajuanStok),
);

// Membuat draft (Biasanya hanya Staff Outlet)
router.post(
  "/",
  checkPermission("create-pengajuan-stok"),
  wrap(pengajuanStokController.createPengajuanStok),
);

// Update isi barang
router.put(
  "/:id",
  checkPermission("update-pengajuan-stok"),
  wrap(pengajuanStokController.updatePengajuanStok),
);

// Mengajukan permintaan (Submit)
router.patch(
  "/:id/submit",
  checkPermission("update-pengajuan-stok"),
  wrap(pengajuanStokController.submitRequest),
);

// MENYETUJUI (Khusus Manager)
router.patch(
  "/:id/approve",
  checkPermission("approve-pengajuan-stok"),
  wrap(pengajuanStokController.approveRequest),
);

// MENOLAK (Khusus Manager)
router.patch(
  "/:id/reject",
  checkPermission("reject-pengajuan-stok"),
  wrap(pengajuanStokController.rejectRequest),
);

module.exports = router;
