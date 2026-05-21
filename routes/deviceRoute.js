const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/deviceController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Helper wrap untuk menangkap error async/await
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(deviceController, req, res, next)).catch(next);
};

// Semua rute di bawah ini wajib melewati gerbang autentikasi pengguna
router.use(authPengguna);

// 1. GET DEVICES (Melihat daftar perangkat milik seorang user)
// Kita gunakan izin 'read-pengguna' karena ini sifatnya hanya melihat data.
router.get(
  "/:userId",
  checkPermission("read-pengguna"),
  wrap(deviceController.getDevices)
);

// 2. APPROVE DEVICE (Menyetujui perangkat yang pending)
// Kita gunakan izin 'update-pengguna' karena ini mengubah status aksesibilitas sistem.
router.post(
  "/approve",
  checkPermission("update-pengguna"),
  wrap(deviceController.approveDevice)
);

// 3. REVOKE DEVICE (Mencabut paksa akses perangkat)
// Kita gunakan izin 'update-pengguna' karena hanya Owner/Manager yang boleh menendang perangkat.
router.post(
  "/revoke",
  checkPermission("update-pengguna"),
  wrap(deviceController.revokeDevice)
);

// 4. SELF-APPROVE DEVICE (Persetujuan Mandiri)
// Rute ini SENGAJA TIDAK menggunakan checkPermission()
// agar kasir biasa yang sudah login di HP pertama bisa masuk.
// Gembok keamanannya berada di dalam Service yang mengunci persetujuan hanya untuk 'penggunaID' miliknya sendiri.
router.post(
  "/self-approve",
  wrap(deviceController.selfApproveDevice)
);
module.exports = router;