const express = require("express");
const router = express.Router();
const transferStokController = require("../controllers/transferStokController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

// Base Route
router
  .route("/")
  .post(
    checkPermission("create-transfer-stok"),
    wrap(transferStokController.createTransferStok),
  )
  .get(
    checkPermission("read-transfer-stok"),
    wrap(transferStokController.getAllTransferStok),
  );

// ID Route
router
  .route("/:id")
  .get(
    checkPermission("read-transfer-stok"),
    wrap(transferStokController.getTransferStokById),
  )
  .put(
    checkPermission("create-transfer-stok"),
    wrap(transferStokController.updateTransferDraft),
  )
  .delete(
    checkPermission("cancel-transfer-stok"),
    wrap(transferStokController.deleteTransferDraft),
  );

// Workflow Routes (Menggunakan PATCH agar konsisten dengan modul lain)
router.patch(
  "/:id/kirim",
  checkPermission("approve-transfer-stok"),
  wrap(transferStokController.markAsKirim),
);
router.patch(
  "/:id/terima",
  checkPermission("receive-transfer-stok"),
  wrap(transferStokController.markAsTerima),
);
router.patch(
  "/:id/batal",
  checkPermission("cancel-transfer-stok"),
  wrap(transferStokController.markAsBatal),
);

module.exports = router;
