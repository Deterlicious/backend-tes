const express = require("express");
const router = express.Router();
const penjualanController = require("../controllers/penjualanController"); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router
  .route("/")
  .post(penjualanController.createPenjualan)
  .get(penjualanController.getAllPenjualan); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router
  .route("/:id")
  .get(penjualanController.getPenjualanById)
  .put(penjualanController.updatePenjualan)
  .delete(penjualanController.deletePenjualan);

module.exports = router;
