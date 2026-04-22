const express = require("express");
const router = express.Router();
const dashboardGudangController = require("../controllers/dashboardGudangController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.get(
  "/gudang",
  checkPermission("read-dashboard-gudang"),
  wrap(dashboardGudangController.getSummary),
);

router.get(
  "/outlet",
  checkPermission("read-dashboard-outlet"),
  wrap(dashboardGudangController.getOutletSummary),
);

module.exports = router;
