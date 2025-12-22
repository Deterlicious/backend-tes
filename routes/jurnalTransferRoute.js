const express = require("express");
const router = express.Router();
const jurnalTransferController = require("../controllers/jurnalTransferController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(jurnalTransferController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(jurnalTransferController.create))
  .get(wrap(jurnalTransferController.getAll));

router
  .route("/:id")
  .get(wrap(jurnalTransferController.getById))
  .put(wrap(jurnalTransferController.update))
  .delete(wrap(jurnalTransferController.delete));

module.exports = router;