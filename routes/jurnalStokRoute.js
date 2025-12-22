const express = require("express");
const router = express.Router();
const jurnalStokController = require("../controllers/jurnalStokController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ ASYNC WRAPPER
 * Menangkap error dari fungsi async dan meneruskannya ke Global Error Handler
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- PROTECTED ROUTES ---
// Mengaktifkan autentikasi untuk semua endpoint di bawah ini
router.use(authPengguna);

router.post("/", wrap(jurnalStokController.createJurnalStok));
router.get("/", wrap(jurnalStokController.getAllJurnalStok));
router.get("/:id", wrap(jurnalStokController.getJurnalStokById));
router.put("/:id", wrap(jurnalStokController.updateJurnalStok));
router.delete("/:id", wrap(jurnalStokController.deleteJurnalStok));

module.exports = router;
