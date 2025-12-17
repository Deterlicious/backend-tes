const express = require("express");
const router = express.Router();
const akunController = require("../controllers/akunController");

// 1. IMPORT MIDDLEWARE YANG BENAR
const authAkun = require("../middleware/authAkun"); 
const { adminOnly } = require("../middleware/authorize");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(akunController, req, res, next)).catch(next);
};

// public routes (tidak perlu token)
router.post("/auth/register", wrap(akunController.register));
router.post("/auth/login", wrap(akunController.login));
router.post("/auth/refreshtoken", wrap(akunController.refreshToken));
router.post("/auth/logout", wrap(akunController.logout));

router.use(authAkun);

router.get("/auth/akun", wrap(akunController.getProfile));
router.put("/auth/akun", wrap(akunController.updateProfile));

// Hanya role 'admin' yang bisa akses rute ini
router.get("/admin/all", adminOnly, wrap(akunController.getAllAkun));
router.delete("/admin/users/:id", adminOnly, wrap(akunController.deleteUserByAdmin)); 

// DEVICE MANAGEMENT (Client Boleh Akses Punya Sendiri)
router.get("/device", wrap(akunController.getDevice));
router.post("/device/add", wrap(akunController.addDevice));
router.put("/device/promote", wrap(akunController.promoteDevice));
router.put("/device/demote", wrap(akunController.demoteDevice));
router.delete("/device/remove", wrap(akunController.removeDevice));
router.get("/devicehistory", wrap(akunController.getDeviceHistory));

module.exports = router;