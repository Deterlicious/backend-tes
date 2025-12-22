const express = require("express");
const router = express.Router();
const bebanOperasionalController = require("../controllers/bebanOperasionalController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Memastikan error async ditangkap dan diteruskan ke middleware error handler global.
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
// Mengunci seluruh endpoint Beban Operasional dengan Authentication
router.use(authPengguna);

router.post("/", wrap(bebanOperasionalController.createBebanOperasional));
router.get("/", wrap(bebanOperasionalController.getAllBebanOperasional));
router.get("/:id", wrap(bebanOperasionalController.getBebanOperasionalById));
router.put("/:id", wrap(bebanOperasionalController.updateBebanOperasional));
router.delete("/:id", wrap(bebanOperasionalController.deleteBebanOperasional));

module.exports = router;
