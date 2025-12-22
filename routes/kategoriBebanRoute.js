const express = require("express");
const router = express.Router();
const kategoriBebanController = require("../controllers/kategoriBebanController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(kategoriBebanController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(kategoriBebanController.create))
  .get(wrap(kategoriBebanController.getAll));

router
  .route("/:id")
  .get(wrap(kategoriBebanController.getById))
  .put(wrap(kategoriBebanController.update))
  .delete(wrap(kategoriBebanController.delete));

module.exports = router;