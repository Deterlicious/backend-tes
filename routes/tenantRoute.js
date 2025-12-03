const express = require("express");
const router = express.Router();

const tenantController = require("../controllers/tenantController");

// Utility wrapper agar Express tidak kehilangan konteks `this`
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(tenantController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(wrap(tenantController.create))
  .get(wrap(tenantController.getAll));

router
  .route("/:id")
  .get(wrap(tenantController.getById))
  .put(wrap(tenantController.update))
  .delete(wrap(tenantController.delete));

module.exports = router;
