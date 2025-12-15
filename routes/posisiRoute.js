const express = require("express");
const router = express.Router();
const posisiController = require("../controllers/posisiController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(posisiController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(posisiController.create))
  .get(wrap(posisiController.getAll));

router
  .route("/:id")
  .get(wrap(posisiController.getById))
  .put(wrap(posisiController.update))
  .delete(wrap(posisiController.delete));

module.exports = router;