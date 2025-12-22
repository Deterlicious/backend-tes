const express = require("express");
const router = express.Router();
const asetController = require("../controllers/asetController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Memastikan error dalam fungsi async ditangkap dengan benar
 * dan diteruskan ke global error handler (next).
 */
const wrap = (fn) => (req, res, next) => {
  if (!fn) {
    return next(
      new Error(
        `Controller method tidak ditemukan untuk route: ${req.originalUrl}`
      )
    );
  }
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- PROTECTED ROUTES ---
// Seluruh akses ke modul Aset wajib melewati middleware autentikasi
router.use(authPengguna);

router.post("/", wrap(asetController.createAset));
router.get("/", wrap(asetController.getAllAset));
router.get("/:id", wrap(asetController.getAsetById));
router.put("/:id", wrap(asetController.updateAset));
router.delete("/:id", wrap(asetController.deleteAset));

module.exports = router;
