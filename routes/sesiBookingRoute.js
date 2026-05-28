const express = require("express");
const router = express.Router();

const sesiBookingController = require("../controllers/sesiBookingController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission"); // Tambahkan import ini

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn.call(sesiBookingController, req, res, next)).catch(next);

// Autentikasi wajib untuk semua rute
router.use(authPengguna);

router
  .route("/")
  .post(
    checkPermission("create-booking"), 
    wrap(sesiBookingController.create)
  )
  .get(
    checkPermission("read-booking"), 
    wrap(sesiBookingController.getAll)
  );

router
  .route("/:id")
  .get(
    checkPermission("read-booking"), 
    wrap(sesiBookingController.getById)
  )
  .put(
    checkPermission("update-booking"), 
    wrap(sesiBookingController.update)
  )
  .delete(
    checkPermission("delete-booking"), 
    wrap(sesiBookingController.delete)
  );

module.exports = router;