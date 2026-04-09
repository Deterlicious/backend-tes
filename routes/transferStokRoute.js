const express = require("express");
const router = express.Router();
const transferStokController = require("../controllers/transferStokController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

// Base Route
router
  .route("/")
  .post(wrap(transferStokController.createTransferStok))
  .get(wrap(transferStokController.getAllTransferStok));

// ID Route
router
  .route("/:id")
  .get(wrap(transferStokController.getTransferStokById))
  .put(wrap(transferStokController.updateTransferDraft))
  .delete(wrap(transferStokController.deleteTransferDraft));

// Workflow Routes (Menggunakan PATCH agar konsisten dengan modul lain)
router.patch("/:id/kirim", wrap(transferStokController.markAsKirim));
router.patch("/:id/terima", wrap(transferStokController.markAsTerima));
router.patch("/:id/batal", wrap(transferStokController.markAsBatal));

module.exports = router;
