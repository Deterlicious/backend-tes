const express = require("express");
const router = express.Router();
const absensiController = require("../controllers/absensiController");

// 1. IMPORT MIDDLEWARE (Menggunakan authPengguna sesuai standar tim)
const authPengguna = require("../middleware/authPengguna");
// 2. WRAPPER UTILITY (Standar Tim)
// Memastikan context 'this' tetap merujuk pada absensiController dan menangani catch(next)
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(absensiController, req, res, next)).catch(next);
};

// --- PROTECTED ROUTES (Memerlukan Token) ---
router.use(authPengguna);

// Endpoint Absensi
router.post("/", wrap(absensiController.createAbsensi));
router.get("/", wrap(absensiController.getAllAbsensi));
router.get("/:id", wrap(absensiController.getAbsensiById));
router.put("/:id", wrap(absensiController.updateAbsensi));
router.delete("/:id", wrap(absensiController.deleteAbsensi));

module.exports = router;
