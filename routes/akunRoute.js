const express = require("express");
const router = express.Router();
const akunController = require("../controllers/akunController");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// Auth
router.post("/auth/register", akunController.register);
router.post("/auth/login", akunController.login);
router.post("/auth/refreshtoken", akunController.refreshToken);
router.post("/auth/logout", akunController.logout);
router.post("/auth/logoutall", auth, akunController.logoutAllDevices);
router.get("/auth/akun", auth, akunController.getProfile);
router.put("/auth/akun", auth, akunController.updateProfile);
router.delete("/auth/akun", auth, akunController.deleteProfile);

// Admin
router.get("/admin/all", auth, authorize.adminOnly, akunController.getAllAkun);

// Device
router.get("/device", auth, akunController.getDevice);
router.get("/device/check/:deviceId", auth, akunController.checkDevice);
router.post("/device/add", auth, akunController.addDevice);
router.put("/device/promote", auth, akunController.promoteDevice);
router.put("/device/demote", auth, akunController.demoteDevice);
router.delete("/device/remove", auth, akunController.removeDevice);

// Device History
router.get("/devicehistory", auth, akunController.getDeviceHistory);
router.post("/devicehistory", auth, akunController.addDeviceHistory);
router.delete("/devicehistory/:id", auth, akunController.deleteDeviceHistory);

module.exports = router;