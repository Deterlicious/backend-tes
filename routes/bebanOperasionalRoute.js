const express = require("express");
const router = express.Router();
const bebanOperasionalController = require("../controllers/bebanOperasionalController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(bebanOperasionalController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(bebanOperasionalController.create))
  .get(wrap(bebanOperasionalController.getAll));

router
  .route("/:id")
  .get(wrap(bebanOperasionalController.getById))
  .put(wrap(bebanOperasionalController.update))
  .delete(wrap(bebanOperasionalController.delete));

module.exports = router;