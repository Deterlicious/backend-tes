const express = require("express");
const router = express.Router();
const tenantController = require("../controllers/tenantController");

// Middleware
const authAkun = require("../middleware/authAkun"); // untuk create awal
const authPengguna = require("../middleware/authPengguna");
const { adminOnly } = require("../middleware/authorize");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(tenantController, req, res, next)).catch(next);
};

// ==========================================
// 🔹 CREATE TENANT (PAKAI AKUN - SETUP AWAL)
// ==========================================
router.post("/", authAkun, wrap(tenantController.create));


// ==========================================
// 🔹 RBAC (SETELAH ADA PENGGUNA)
// ==========================================
router.use(authPengguna);


// ==========================================
// 🔹 READ TENANT
// ==========================================
router.get(
  "/:id",
  checkPermission("read-tenant"),
  wrap(tenantController.getById)
);


// ==========================================
// 🔹 UPDATE TENANT
// ==========================================
router.put(
  "/:id",
  checkPermission("update-tenant"),
  wrap(tenantController.update)
);


// ==========================================
// 🔹 DELETE TENANT
// ==========================================
router.delete(
  "/:id",
  checkPermission("delete-tenant"),
  wrap(tenantController.delete)
);


// ==========================================
// 🔹 ADMIN ONLY
// ==========================================
router.get(
  "/",
  adminOnly,
  wrap(tenantController.getAll)
);

module.exports = router;