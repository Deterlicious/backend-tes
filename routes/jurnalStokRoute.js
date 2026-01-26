const express = require("express");
const router = express.Router();
const jurnalStokController = require("../controllers/jurnalStokController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(jurnalStokController, req, res, next)).catch(next);
};

router.use(authPengguna);

router
  .route("/")
  .post(wrap(jurnalStokController.create))
  .get(wrap(jurnalStokController.getAll));

router
  .route("/:id")
  .get(wrap(jurnalStokController.getById))
  .put(wrap(jurnalStokController.update))
  .delete(wrap(jurnalStokController.delete));

module.exports = router;