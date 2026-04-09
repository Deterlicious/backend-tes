const express = require("express");
const router = express.Router();
const permintaanStokController = require("../controllers/permintaanStokController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

// Membuat draft permintaan baru
router.post("/", wrap(permintaanStokController.createPermintaanStok));

// Menggunakan PATCH untuk perubahan status (Workflow)
router.patch("/:id/submit", wrap(permintaanStokController.submitRequest));
router.patch("/:id/approve", wrap(permintaanStokController.approveRequest));
router.patch("/:id/reject", wrap(permintaanStokController.rejectRequest));

module.exports = router;
