const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const authPengguna = require("../middleware/authPengguna");

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
router.post("/", wrap(locationController.createLocation));
router.get("/", wrap(locationController.getLocations));
router.get("/:id", wrap(locationController.getLocationById));
router.put("/:id", wrap(locationController.updateLocation));
router.delete("/:id", wrap(locationController.deleteLocation));

module.exports = router;
