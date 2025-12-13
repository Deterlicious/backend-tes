const express = require("express");
const router = express.Router();
const transferStokController = require("../controllers/transferStokController"); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router
  .route("/")
  .post(transferStokController.createTransferStok)
  .get(transferStokController.getAllTransferStok); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router
  .route("/:id")
  .get(transferStokController.getTransferStokById)
  .put(transferStokController.updateTransferDraft)
  .delete(transferStokController.deleteTransferDraft);

// Route untuk UPDATE STATUS (DIKIRIM, DITERIMA, BATAL)
router.route("/:id/kirim").put(transferStokController.markAsKirim);

router.route("/:id/terima").put(transferStokController.markAsTerima);

router.route("/:id/batal").put(transferStokController.markAsBatal);

module.exports = router;
