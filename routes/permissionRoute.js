const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

const authPengguna = require("../middleware/authPengguna");
const authAkun = require("../middleware/authAkun"); // 🔥 Tambahan
const { adminOnly } = require("../middleware/authorize");

// Wrapper async
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(permissionController, req, res, next)).catch(next);
};


// =========================
// 🔐 READ (OWNER / STAFF)
// =========================
router.use(authPengguna);

router.get("/", wrap(permissionController.getAll));
router.get("/grouped", wrap(permissionController.getGrouped));


// =========================
// 🔐 MANAGEMENT (ADMIN ONLY)
// =========================
// 🔥 Ini level SaaS, bukan tenant
router.post(
  "/",
  authAkun,
  adminOnly,
  wrap(permissionController.create)
);

router.put(
  "/:id",
  authAkun,
  adminOnly,
  wrap(permissionController.update)
);

router.delete(
  "/:id",
  authAkun,
  adminOnly,
  wrap(permissionController.delete)
);

module.exports = router;