const express = require("express");
const router = express.Router();
const akunKasController = require("../controllers/akunKasController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(akunKasController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(akunKasController.create))
  .get(wrap(akunKasController.getAll));

router
  .route("/:id")
  .get(wrap(akunKasController.getById))
  .put(wrap(akunKasController.update))
  .delete(wrap(akunKasController.delete));

module.exports = router;