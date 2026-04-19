const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");

const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

/**
 * Wrapper async handler
 */
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(roleController, req, res, next)).catch(next);
};

// ==========================================
// PROTEKSI GLOBAL
// ==========================================
router.use(authPengguna);


// ==========================================
// ROLE ROUTES (DENGAN PERMISSION)
// ==========================================

// 1. GET ALL ROLE
router.get(
  "/",
  checkPermission("read-role"),
  wrap(roleController.getAll)
);

// 2. GET BY ID
router.get(
  "/:id",
  checkPermission("read-role"),
  wrap(roleController.getById)
);

// 3. CREATE ROLE
router.post(
  "/",
  checkPermission("create-role"),
  wrap(roleController.create)
);

// 4. UPDATE ROLE
router.put(
  "/:id",
  checkPermission("update-role"),
  wrap(roleController.update)
);

// 5. DELETE ROLE
router.delete(
  "/:id",
  checkPermission("delete-role"),
  wrap(roleController.delete)
);

module.exports = router;