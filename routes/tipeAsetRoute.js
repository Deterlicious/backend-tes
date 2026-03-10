const express = require("express");
const router = express.Router();

const tipeAsetController = require("../controllers/tipeAsetController");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(tipeAsetController, req, res, next)).catch(next);

router
  .route("/")
  .post(wrap(tipeAsetController.create))
  .get(wrap(tipeAsetController.getAll));

router
  .route("/:id")
  .get(wrap(tipeAsetController.getById))
  .put(wrap(tipeAsetController.update))
  .delete(wrap(tipeAsetController.delete));

module.exports = router;