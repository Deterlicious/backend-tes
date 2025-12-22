const express = require("express");
const router = express.Router();
const pelangganController = require("../controllers/pelangganController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(pelangganController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(pelangganController.create))
  .get(wrap(pelangganController.getAll));

router
  .route("/:id")
  .get(wrap(pelangganController.getById))
  .put(wrap(pelangganController.update))
  .delete(wrap(pelangganController.delete));

module.exports = router;