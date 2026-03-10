const express = require("express");
const router = express.Router();

const pembayaranController = require("../controllers/pembayaranController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(pembayaranController, req, res, next)).catch(next);

router.use(authPengguna);

router
  .route("/")
  .post(wrap(pembayaranController.create))
  .get(wrap(pembayaranController.getAll));

router
  .route("/:id")
  .get(wrap(pembayaranController.getById))
  .put(wrap(pembayaranController.update))
  .delete(wrap(pembayaranController.delete));

module.exports = router;