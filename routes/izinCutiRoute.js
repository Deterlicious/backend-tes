const express = require("express");
const router = express.Router();
const izinCutiController = require("../controllers/izinCutiController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(izinCutiController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(izinCutiController.create))
  .get(wrap(izinCutiController.getAll));

router
  .route("/:id")
  .get(wrap(izinCutiController.getById))
  .put(wrap(izinCutiController.update))
  .delete(wrap(izinCutiController.delete));

module.exports = router;