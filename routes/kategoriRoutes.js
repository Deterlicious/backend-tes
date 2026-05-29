const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Import middleware permission
// Utility wrapper (tetap dipakai, sudah benar)
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kategoriController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(authPengguna, checkPermission("create-kategori"), wrap(kategoriController.create))
  .get(authPengguna, checkPermission("read-kategori"), wrap(kategoriController.getAll));

router
  .route("/:id")
  .get(authPengguna, checkPermission("read-kategori"), wrap(kategoriController.getById))
  .put(authPengguna, checkPermission("update-kategori"), wrap(kategoriController.update))
  .delete(authPengguna, checkPermission("delete-kategori"), wrap(kategoriController.delete));

module.exports = router;
