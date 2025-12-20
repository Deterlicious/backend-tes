const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");
const authPengguna = require("../middleware/authPengguna");

// Utility wrapper (tetap dipakai, sudah benar)
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kategoriController, req, res, next)).catch(next);
};

router
  .route("/")
  .post(authPengguna, wrap(kategoriController.create))
  .get(authPengguna, wrap(kategoriController.getAll));

router
  .route("/:id")
  .get(authPengguna, wrap(kategoriController.getById))
  .put(authPengguna, wrap(kategoriController.update))
  .delete(authPengguna, wrap(kategoriController.delete));

module.exports = router;
