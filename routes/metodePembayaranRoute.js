const express = require("express");
const router = express.Router();

const metodePembayaranController = require("../controllers/metodePembayaranController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(metodePembayaranController, req, res, next)).catch(next);

router.use(authPengguna);

router
  .route("/")
  .post(wrap(metodePembayaranController.create))
  .get(wrap(metodePembayaranController.getAll));

router
  .route("/:id")
  .get(wrap(metodePembayaranController.getById))
  .put(wrap(metodePembayaranController.update))
  .delete(wrap(metodePembayaranController.delete));

module.exports = router;