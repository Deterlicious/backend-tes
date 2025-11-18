const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");

const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

router.post("/pin-login", penggunaController.loginPin);

router.post("/pin-refresh", penggunaController.refreshTokenPin);

router.post("/pin-logout", authPengguna, penggunaController.logoutPin);

router.post(
  "/",
  [authPengguna, checkPermission("kelola-pengguna")],
  penggunaController.createPengguna
);

router.get(
  "/",
  [authPengguna, checkPermission("lihat-pengguna")],
  penggunaController.getAllPengguna
);

router.get(
  "/:id",
  [authPengguna, checkPermission("lihat-pengguna")],
  penggunaController.getPenggunaById
);

router.put(
  "/:id",
  [authPengguna, checkPermission("kelola-pengguna")],
  penggunaController.updatePengguna
);

router.delete(
  "/:id",
  [authPengguna, checkPermission("kelola-pengguna")],
  penggunaController.deletePengguna
);

module.exports = router;