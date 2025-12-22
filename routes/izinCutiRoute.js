const express = require("express");
const router = express.Router();
const izinCutiController = require("../controllers/izinCutiController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Memastikan error async ditangkap dan dialirkan ke next(err)
 * agar ditangani oleh Global Error Handler.
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- MIDDLEWARE PROTEKSI ---
// Semua route di bawah ini wajib menggunakan Token JWT yang valid
router.use(authPengguna);

router.post("/", wrap(izinCutiController.createIzinCuti));
router.get("/", wrap(izinCutiController.getAllIzinCuti));
router.get("/:id", wrap(izinCutiController.getIzinCutiById));
router.put("/:id", wrap(izinCutiController.updateIzinCuti));
router.delete("/:id", wrap(izinCutiController.deleteIzinCuti));

module.exports = router;
