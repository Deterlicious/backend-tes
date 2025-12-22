const express = require("express");
const router = express.Router();
const paketMembershipController = require("../controllers/paketMembershipController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Menangani async/await dan memastikan error diteruskan ke next(err).
 */
const wrap = (fn) => (req, res, next) => {
  if (!fn) {
    return next(
      new Error("Handler tidak ditemukan di PaketMembershipController!")
    );
  }
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- PROTECTED ROUTES ---
// Semua operasional paket membership wajib login (req.pengguna)
router.use(authPengguna);

router.post("/", wrap(paketMembershipController.createPaketMembership));
router.get("/", wrap(paketMembershipController.getAllPaketMembership));
router.get("/:id", wrap(paketMembershipController.getPaketMembershipById));
router.put("/:id", wrap(paketMembershipController.updatePaketMembership));
router.delete("/:id", wrap(paketMembershipController.deletePaketMembership));

module.exports = router;
