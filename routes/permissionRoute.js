const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const authPengguna = require("../middleware/authPengguna");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(permissionController, req, res, next)).catch(next);
};

router.get("/", wrap(permissionController.getAllPermissions)); // Alias getAll
router.get("/grouped", authPengguna, wrap(permissionController.getGrouped));

router.post("/", wrap(permissionController.create));
router.delete("/:id", wrap(permissionController.delete));

// Redirect method names to match controller
router.get("/", wrap(permissionController.getAll));

module.exports = router;