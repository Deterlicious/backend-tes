const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Utility wrapper (tetap dipakai, sudah benar)
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kategoriController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(checkPermission("kelola-kategori"), wrap(kategoriController.create))
  .get(checkPermission("kelola-kategori"), wrap(kategoriController.getAll));

router
  .route("/:id")
  .get(checkPermission("kelola-kategori"), wrap(kategoriController.getById))
  .put(checkPermission("kelola-kategori"), wrap(kategoriController.update))
  .delete(checkPermission("kelola-kategori"), wrap(kategoriController.delete));

module.exports = router;
