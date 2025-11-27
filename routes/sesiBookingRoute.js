const express = require("express");
const router = express.Router();
const sesiBookingController = require("../controllers/sesiBookingController");

router.post("/", sesiBookingController.createBooking);
router.get("/", sesiBookingController.getAllBooking);
router.get("/:id", sesiBookingController.getBookingById);
router.put("/:id", sesiBookingController.updateBooking);
router.delete("/:id", sesiBookingController.deleteBooking);

module.exports = router;