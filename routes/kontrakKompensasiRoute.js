const express = require("express");
const router = express.Router();
const kontrakController = require("../controllers/kontrakKompensasiController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kontrakController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(kontrakController.create))
  .get(wrap(kontrakController.getAll));

router
  .route("/:id")
  .get(wrap(kontrakController.getById))
  .put(wrap(kontrakController.update))
  .delete(wrap(kontrakController.delete));

module.exports = router;