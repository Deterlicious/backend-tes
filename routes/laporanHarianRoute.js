const express = require("express");
const router = express.Router();
const laporanHarianController = require("../controllers/laporanHarianController");

// GET all Laporan Harian for a tenant
router.get("/", laporanHarianController.getAll);

// GET Laporan Harian by ID
router.get("/:id", laporanHarianController.getById);

// DELETE Laporan Harian by ID (Biasanya hanya oleh Super Admin/Finance)
router.delete("/:id", laporanHarianController.delete);

module.exports = router;
