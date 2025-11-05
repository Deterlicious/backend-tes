const express = require("express");
const router = express.Router();
const akunController = require("../controllers/akunController");
const auth = require("../middleware/auth");

// Rute Autentikasi & Profil
router.post("/auth/register", akunController.register);
router.post("/auth/login", akunController.login);
router.post("/auth/refresh-token", akunController.refreshToken);
router.post("/auth/logout", akunController.logout);
router.post("/auth/logout-all", auth, akunController.logoutAllDevices);
router.get("/auth/profile", auth, akunController.getProfile);
router.put("/auth/profile", auth, akunController.updateProfile);
router.delete("/auth/delete", auth, akunController.deleteProfile);

// Rute Manajemen Device
router.get("/devices", auth, akunController.getDevices);
router.get("/devices/check/:deviceId", auth, akunController.checkDevice);
router.post("/devices/add", auth, akunController.addDevice);
router.put("/device/promote", auth, akunController.promoteDevice);
router.put("/device/demote", auth, akunController.demoteDevice);
router.delete("/device/remove", auth, akunController.removeDevice);

// Rute Riwayat Device
router.get("/device-history", auth, akunController.getDeviceHistory);
router.post("/device-history", auth, akunController.addDeviceHistory);
router.delete("/device-history/:id", auth, akunController.deleteDeviceHistory);

module.exports = router;