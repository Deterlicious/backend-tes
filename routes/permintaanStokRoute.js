// permintaanStokRouter.js
const express = require("express");
const router = express.Router();
const permintaanStokController = require("../controllers/permintaanStokController");

// Route untuk CREATE dan READ ALL
router
  .route("/")
  .post(permintaanStokController.createPermintaanStok)
  .get(permintaanStokController.getAllPermintaanStok);

// Route untuk READ BY ID, UPDATE DRAFT, dan DELETE DRAFT
router
  .route("/:id")
  .get(permintaanStokController.getPermintaanStokById)
  .put(permintaanStokController.updatePermintaanDraft)
  .delete(permintaanStokController.deletePermintaanDraft);

// Route untuk UPDATE STATUS (SUBMIT, APPROVE, REJECT)
router.route("/:id/submit").put(permintaanStokController.submitRequest);

router.route("/:id/approve").put(permintaanStokController.approveRequest);

router.route("/:id/reject").put(permintaanStokController.rejectRequest);

module.exports = router;
