const express = require("express");
const router = express.Router();

const penjualanController = require("../controllers/penjualanController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(penjualanController, req, res, next)).catch(next);

router.use(authPengguna);

router
  .route("/")
  .post(wrap(penjualanController.create))
  .get(wrap(penjualanController.getAll));

router
  .route("/:id")
  .get(wrap(penjualanController.getById))
  .put(wrap(penjualanController.update))
  .delete(wrap(penjualanController.delete));

module.exports = router;