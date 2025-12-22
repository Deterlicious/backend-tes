const express = require("express");
const router = express.Router();
const diskonController = require("../controllers/diskonController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Memastikan error async ditangkap dan diteruskan ke middleware error handler global
 * sesuai dengan pola next(err) yang digunakan di Controller.
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- PROTECTED ROUTES ---
// Seluruh endpoint diskon dilindungi oleh authPengguna
router.use(authPengguna);

router.post("/", wrap(diskonController.createDiskon));
router.get("/", wrap(diskonController.getAllDiskon));
router.get("/:id", wrap(diskonController.getDiskonById));
router.put("/:id", wrap(diskonController.updateDiskon));
router.delete("/:id", wrap(diskonController.deleteDiskon));

module.exports = router;
