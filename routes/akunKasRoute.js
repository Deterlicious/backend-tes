const express = require("express");
const router = express.Router();
const akunKasController = require("../controllers/akunKasController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Memastikan error async ditangkap dan diteruskan ke next(err)
 * sesuai standar keamanan global.
 */
const wrap = (fn) => (req, res, next) => {
  if (!fn) {
    return next(
      new Error(`Handler tidak ditemukan untuk route: ${req.originalUrl}`)
    );
  }
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- PROTECTED ROUTES ---
// Mengunci seluruh endpoint Akun Kas dengan Authentication
router.use(authPengguna);

router.post("/", wrap(akunKasController.createAkunKas));
router.get("/", wrap(akunKasController.getAllAkunKas));
router.get("/:id", wrap(akunKasController.getAkunKasById));
router.put("/:id", wrap(akunKasController.updateAkunKas));
router.delete("/:id", wrap(akunKasController.deleteAkunKas));

module.exports = router;
