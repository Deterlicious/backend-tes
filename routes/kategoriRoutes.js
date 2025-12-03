const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");

// Utility wrapper (sama seperti Tenant)
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kategoriController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(kategoriController.create))
  .get(wrap(kategoriController.getAll));

router
  .route("/:id")
  .get(wrap(kategoriController.getById))
  .put(wrap(kategoriController.update))
  .delete(wrap(kategoriController.delete));

module.exports = router;