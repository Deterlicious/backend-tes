const express = require("express");
const router = express.Router();
const laporanBulananController = require("../controllers/laporanBulananController");
//import middleware authPengguna
const authPengguna = require("../middleware/authPengguna");

router.use(authPengguna);

// POST: Trigger Aggregation/Generation (Generate Laporan Bulanan dari Laporan Harian)
router.post("/generate", laporanBulananController.generate);

// GET all Laporan Bulanan for a tenant
router.get("/", laporanBulananController.getAll);

// GET Laporan Bulanan by ID
router.get("/:id", laporanBulananController.getById);

// DELETE Laporan Bulanan by ID
router.delete("/:id", laporanBulananController.delete);

module.exports = router;
