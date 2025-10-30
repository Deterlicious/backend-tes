const express = require("express");
const router = express.Router();
const absensiController = require("../controllers/absensiController");

router.post("/", absensiController.createAbsensi);
router.get("/", absensiController.getAllAbsensi);
router.get("/:id", absensiController.getAbsensiById);
router.put("/:id", absensiController.updateAbsensi);
router.delete("/:id", absensiController.deleteAbsensi);

module.exports = router;
