const express = require("express");
const router = express.Router();
const absensiController = require("../controllers/absensiController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(absensiController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(absensiController.create))
  .get(wrap(absensiController.getAll));

router
  .route("/:id")
  .get(wrap(absensiController.getById))
  .put(wrap(absensiController.update))
  .delete(wrap(absensiController.delete));

module.exports = router;