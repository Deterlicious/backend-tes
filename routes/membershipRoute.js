const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membershipController");
const authPengguna = require("../middleware/authPengguna");

/**
 * 🛠️ WRAPPER UTILITY
 * Memastikan context 'this' aman dan menangani catch(next) secara otomatis.
 */
const wrap = (fn) => (req, res, next) => {
  if (!fn) {
    return next(
      new Error("Route handler tidak ditemukan di MembershipController!")
    );
  }
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- PROTECTED ROUTES ---
// Semua endpoint di bawah ini wajib menggunakan Token (req.pengguna)
router.use(authPengguna);

router.post("/", wrap(membershipController.createMembership));
router.get("/", wrap(membershipController.getAllMembership));
router.get("/:id", wrap(membershipController.getMembershipById));
router.put("/:id", wrap(membershipController.updateMembership));
router.delete("/:id", wrap(membershipController.deleteMembership));

module.exports = router;
