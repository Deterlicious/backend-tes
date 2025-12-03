const express = require("express");
const router = express.Router();
const bahanBakuController = require("../controllers/bahanBakuController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(bahanBakuController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(bahanBakuController.create))
  .get(wrap(bahanBakuController.getAll));

router
  .route("/:id")
  .get(wrap(bahanBakuController.getById))
  .put(wrap(bahanBakuController.update))
  .delete(wrap(bahanBakuController.delete));

module.exports = router;