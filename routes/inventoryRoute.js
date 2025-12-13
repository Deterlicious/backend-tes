// inventoryRouter.js
const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

// Route untuk CREATE dan READ ALL
// Endpoint: POST /api/inventory & GET /api/inventory
router
  .route("/")
  .post(inventoryController.createInventory)
  .get(inventoryController.getAllInventory); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
// Endpoint: /api/inventory/:id
router
  .route("/:id")
  .get(inventoryController.getInventoryById)
  .put(inventoryController.updateInventory)
  .delete(inventoryController.deleteInventory);

module.exports = router;
