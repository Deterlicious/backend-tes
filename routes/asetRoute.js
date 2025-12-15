const express = require("express");
const router = express.Router();
const asetController = require("../controllers/asetController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(asetController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(asetController.create))
  .get(wrap(asetController.getAll));

router
  .route("/:id")
  .get(wrap(asetController.getById))
  .put(wrap(asetController.update))
  .delete(wrap(asetController.delete));

module.exports = router;