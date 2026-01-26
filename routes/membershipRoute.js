const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membershipController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(membershipController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(membershipController.create))
  .get(wrap(membershipController.getAll));

router
  .route("/:id")
  .get(wrap(membershipController.getById))
  .put(wrap(membershipController.update))
  .delete(wrap(membershipController.delete));

module.exports = router;