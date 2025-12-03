// const express = require("express");
// const router = express.Router();
// const akunController = require("../controllers/akunController");
// const auth = require("../middleware/auth");
// const authorize = require("../middleware/authorize");

// // Auth
// router.post("/auth/register", akunController.register);
// router.post("/auth/login", akunController.login);
// router.post("/auth/refreshtoken", akunController.refreshToken);
// router.post("/auth/logout", akunController.logout);
// router.post("/auth/logoutall", auth, akunController.logoutAllDevices);
// router.get("/auth/akun", auth, akunController.getProfile);
// router.put("/auth/akun", auth, akunController.updateProfile);
// router.delete("/auth/akun", auth, akunController.deleteProfile);

// // Admin
// router.get("/admin/all", auth, authorize.adminOnly, akunController.getAllAkun);

// // Device
// router.get("/device", auth, akunController.getDevice);
// router.get("/device/check/:deviceId", auth, akunController.checkDevice);
// router.post("/device/add", auth, akunController.addDevice);
// router.put("/device/promote", auth, akunController.promoteDevice);
// router.put("/device/demote", auth, akunController.demoteDevice);
// router.delete("/device/remove", auth, akunController.removeDevice);

// // Device History
// router.get("/devicehistory", auth, akunController.getDeviceHistory);
// router.post("/devicehistory", auth, akunController.addDeviceHistory);
// router.delete("/devicehistory/:id", auth, akunController.deleteDeviceHistory);

// module.exports = router;


const express = require("express");
const router = express.Router();
const akunController = require("../controllers/akunController");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(akunController, req, res, next)).catch(next);
};

// Auth
router.post("/auth/register", wrap(akunController.register));
router.post("/auth/login", wrap(akunController.login));
router.post("/auth/refreshtoken", wrap(akunController.refreshToken));
router.post("/auth/logout", wrap(akunController.logout));

// Profile
router.get("/auth/akun", auth, wrap(akunController.getProfile));
router.put("/auth/akun", auth, wrap(akunController.updateProfile));
router.delete("/auth/akun", auth, wrap(akunController.deleteProfile));

// Admin
router.get("/admin/all", auth, authorize.adminOnly, wrap(akunController.getAllAkun));

// Device
router.get("/device", auth, wrap(akunController.getDevice));
router.post("/device/add", auth, wrap(akunController.addDevice));
router.put("/device/promote", auth, wrap(akunController.promoteDevice));
router.put("/device/demote", auth, wrap(akunController.demoteDevice));
router.delete("/device/remove", auth, wrap(akunController.removeDevice));

// Device History
router.get("/devicehistory", auth, wrap(akunController.getDeviceHistory));
// Note: History add/delete manual biasanya tidak diperlukan via API publik 
// karena otomatis dicatat oleh sistem saat add/remove device.

module.exports = router;