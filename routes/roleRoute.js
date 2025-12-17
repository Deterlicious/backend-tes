const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(roleController, req, res, next)).catch(next);
};

router.use(authPengguna); // Proteksi global: semua route butuh token akun

router.get("/", wrap(roleController.getAll));

router.get("/:id", wrap(roleController.getById));

router.post("/", checkPermission("kelola-staff"), wrap(roleController.create));

router.put(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(roleController.update)
);

router.delete(
  "/:id",
  checkPermission("kelola-staff"),
  wrap(roleController.delete)
);

module.exports = router;
