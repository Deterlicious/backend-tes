const express = require("express");
const router = express.Router();
const sesiBookingController = require("../controllers/sesiBookingController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(sesiBookingController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(sesiBookingController.create))
  .get(wrap(sesiBookingController.getAll));

router
  .route("/:id")
  .get(wrap(sesiBookingController.getById))
  .put(wrap(sesiBookingController.update))
  .delete(wrap(sesiBookingController.delete));

module.exports = router;