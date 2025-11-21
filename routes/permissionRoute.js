const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const authPengguna = require("../middleware/authPengguna");

router.post("/", permissionController.createPermission);
router.get("/grouped", authPengguna, permissionController.getPermissionsGrouped);
router.get("/", permissionController.getAllPermissions);
router.delete("/:id", permissionController.deletePermission);

module.exports = router;