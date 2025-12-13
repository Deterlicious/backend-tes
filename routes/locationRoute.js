// locationRouter.js
const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");

// Route untuk CREATE dan READ ALL
// Endpoint: POST /api/locations & GET /api/locations
router
  .route("/")
  .post(locationController.createLocation)
  .get(locationController.getAllLocations); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
// Endpoint: /api/locations/:id
router
  .route("/:id")
  .get(locationController.getLocationById)
  .put(locationController.updateLocation)
  .delete(locationController.deleteLocation);

module.exports = router;
