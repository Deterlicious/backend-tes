const express = require("express");
const router = express.Router();
const permintaanStokController = require("../controllers/permintaanStokController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

// Membuat draft permintaan baru
router.get("/", wrap(permintaanStokController.getAllPermintaanStok));
// Membuat draft baru
router.post("/", wrap(permintaanStokController.createPermintaanStok));
// Update isi barang (Hanya jika DRAFT atau PENDING < 5 menit)
router.put("/:id", wrap(permintaanStokController.updatePermintaanStok));

// Menggunakan PATCH untuk perubahan status (Workflow)
router.patch("/:id/submit", wrap(permintaanStokController.submitRequest));
router.patch("/:id/approve", wrap(permintaanStokController.approveRequest));
router.patch("/:id/reject", wrap(permintaanStokController.rejectRequest));

module.exports = router;
