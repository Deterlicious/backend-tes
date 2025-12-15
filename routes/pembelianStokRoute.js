const express = require("express");
const router = express.Router();
const pembelianStokController = require("../controllers/pembelianStokController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(pembelianStokController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(pembelianStokController.create))
  .get(wrap(pembelianStokController.getAll));

router
  .route("/:id")
  .get(wrap(pembelianStokController.getById))
  .put(wrap(pembelianStokController.update))
  .delete(wrap(pembelianStokController.delete));

module.exports = router;