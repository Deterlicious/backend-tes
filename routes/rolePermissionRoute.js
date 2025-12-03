const express = require("express");
const router = express.Router();
const rpController = require("../controllers/rolePermissionController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(rpController, req, res, next)).catch(next);
};

// PROTECTED ROUTES
// Manajemen Role Permission sangat krusial, biasanya hanya Owner/Admin yang boleh akses.
// gunakan permission 'kelola-staff' sebagai penjaga (asumsi admin staff juga atur role).
router.post(
  "/",
  authPengguna,
  checkPermission("kelola-staff"),
  wrap(rpController.assignPermission)
);

router.get(
  "/", 
  authPengguna, 
  checkPermission("kelola-staff"), 
  wrap(rpController.getAllRolePermissions)
);

router.get(
  "/by-role/:roleId",
  authPengguna,
  checkPermission("kelola-staff"),
  wrap(rpController.getPermissionsByRole)
);

router.delete(
  "/:id",
  authPengguna,
  checkPermission("kelola-staff"),
  wrap(rpController.removePermission)
);

module.exports = router;
