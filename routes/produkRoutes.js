const express = require("express");
const router = express.Router();
const produkController = require("../controllers/produkController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(produkController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(produkController.create))
  .get(wrap(produkController.getAll));

router
  .route("/:id")
  .get(wrap(produkController.getById))
  .put(wrap(produkController.update))
  .delete(wrap(produkController.delete));

module.exports = router;