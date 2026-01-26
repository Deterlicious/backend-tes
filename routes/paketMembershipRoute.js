const express = require("express");
const router = express.Router();
const paketMembershipController = require("../controllers/paketMembershipController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(paketMembershipController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(paketMembershipController.create))
  .get(wrap(paketMembershipController.getAll));

router
  .route("/:id")
  .get(wrap(paketMembershipController.getById))
  .put(wrap(paketMembershipController.update))
  .delete(wrap(paketMembershipController.delete));

module.exports = router;