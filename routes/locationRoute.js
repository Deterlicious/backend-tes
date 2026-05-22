const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Helper untuk menangani async error tanpa try-catch di controller
const wrap = (fn) => (req, res, next) => {
  if (!fn)
    return next(
      new Error("Controller function not found. Check your exports/imports."),
    );
  return Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authPengguna);

// Definisi Rute (Eksplisit & Seragam)
router.post("/", checkPermission("create-location"), wrap(locationController.createLocation));
router.get("/", checkPermission("read-location"), wrap(locationController.getLocations));
router.get("/:id", checkPermission("read-location"), wrap(locationController.getLocationById));
router.put("/:id", checkPermission("update-location"), wrap(locationController.updateLocation));
router.delete("/:id", checkPermission("delete-location"), wrap(locationController.deleteLocation));

module.exports = router;
