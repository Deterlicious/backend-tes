const express = require("express");
const router = express.Router();
const tenantController = require("../controllers/tenantController");
const authAkun = require("../middleware/authAkun");

// Wrapper utility
const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(tenantController, req, res, next)).catch(next);
};

router.use(authAkun); // Proteksi global: semua route butuh token akun

router
  .route("/")
  .post(wrap(tenantController.create))
  .get(wrap(tenantController.getAll));

router
  .route("/:id")
  .get(wrap(tenantController.getById))
  .put(wrap(tenantController.update))
  .delete(wrap(tenantController.delete));

module.exports = router;