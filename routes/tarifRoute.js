const express = require("express");
const router = express.Router();

const tarifController = require("../controllers/tarifController");
const authPengguna = require("../middleware/authPengguna"); // 1. Import middleware

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(tarifController, req, res, next)).catch(next);

// 2. Pasang middleware secara global untuk rute tarif
router.use(authPengguna);

router
  .route("/")
  .post(wrap(tarifController.create))
  .get(wrap(tarifController.getAll));

router
  .route("/:id")
  .get(wrap(tarifController.getById))
  .put(wrap(tarifController.update))
  .delete(wrap(tarifController.delete));

module.exports = router;