const express = require("express");
const router = express.Router();
const jurnalStokController = require("../controllers/jurnalStokController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(jurnalStokController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(
    checkPermission("kelola-jurnal-stok"),
    wrap(jurnalStokController.create),
  )
  .get(
    checkPermission("read-jurnal-stok"),
    wrap(jurnalStokController.getAll),
  );

router
  .route("/:id")
  .get(
    checkPermission("read-jurnal-stok"),
    wrap(jurnalStokController.getById),
  )
  .put(
    checkPermission("kelola-jurnal-stok"),
    wrap(jurnalStokController.update),
  )
  .delete(
    checkPermission("kelola-jurnal-stok"),
    wrap(jurnalStokController.delete),
  );

module.exports = router;
