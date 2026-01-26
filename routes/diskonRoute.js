const express = require("express");
const router = express.Router();
const diskonController = require("../controllers/diskonController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(diskonController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(diskonController.create))
  .get(wrap(diskonController.getAll));

router
  .route("/:id")
  .get(wrap(diskonController.getById))
  .put(wrap(diskonController.update))
  .delete(wrap(diskonController.delete));

module.exports = router;