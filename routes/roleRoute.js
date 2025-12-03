const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Utility wrapper
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(roleController, req, res, next)).catch(next);
};

// Middleware Global untuk Role (Wajib Login)
router.use(authPengguna);

// ROUTES

// GET ALL (Method di controller: getAll)
router.get("/", wrap(roleController.getAll));

// GET BY ID (Method di controller: getById)
router.get("/:id", wrap(roleController.getById));

// CREATE (Method di controller: create) - Butuh Permission
router.post("/", checkPermission("kelola-staff"), wrap(roleController.create));

// UPDATE (Method di controller: update) - Butuh Permission
router.put(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(roleController.update)
);

// DELETE (Method di controller: delete) - Butuh Permission
router.delete(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(roleController.delete)
);

module.exports = router;
