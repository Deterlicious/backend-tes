const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

router.post("/", permissionController.createPermission);
router.get("/", permissionController.getAllPermissions);
router.delete("/:id", permissionController.deletePermission);

module.exports = router;