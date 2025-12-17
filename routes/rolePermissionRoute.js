const express = require("express");
const router = express.Router();
const rpController = require("../controllers/rolePermissionController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(rpController, req, res, next)).catch(next);
};

router.use(authPengguna); // Proteksi global: semua route butuh token pengguna

router.post(
  "/",
  checkPermission("kelola-staff"),
  wrap(rpController.assignPermission)
);

router.get(
  "/",
  checkPermission("kelola-staff"),
  wrap(rpController.getAllRolePermissions)
);

router.get(
  "/by-role/:roleId",
  checkPermission("kelola-staff"),
  wrap(rpController.getPermissionsByRole)
);

router.delete(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(rpController.removePermission)
);

module.exports = router;
