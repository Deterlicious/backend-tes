const express = require("express");
const router = express.Router();
const rpController = require("../controllers/rolePermissionController");

router.post("/", rpController.assignPermission);

router.get("/by-role/:roleId", rpController.getPermissionsByRole);

router.delete("/:id", rpController.removePermission);

module.exports = router;