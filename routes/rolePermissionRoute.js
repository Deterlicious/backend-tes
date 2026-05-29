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
  checkPermission("update-role"),
  wrap(rpController.assignPermission)
);

router.get(
  "/",
  checkPermission("read-role"),
  wrap(rpController.getAllRolePermissions)
);

router.get(
  "/by-role/:roleId",
  checkPermission("read-role"),
  wrap(rpController.getPermissionsByRole)
);

router.delete(
  "/:id",
  checkPermission("update-role"),
  wrap(rpController.removePermission)
);

module.exports = router;
