const express = require("express");
const router = express.Router();
const tarifController = require("../controllers/tarifController");

router
  .route("/")
  .post(tarifController.createTarif)
  .get(tarifController.getAllTarif);

router
  .route("/:id")
  .get(tarifController.getTarifById)
  .put(tarifController.updateTarif)
  .delete(tarifController.deleteTarif);

module.exports = router;
