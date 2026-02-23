const express = require("express");
const router = express.Router();
const permintaanStokController = require("../controllers/permintaanStokController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", wrap(permintaanStokController.createPermintaanStok));
router.put("/:id/submit", wrap(permintaanStokController.submitRequest));
router.put("/:id/approve", wrap(permintaanStokController.approveRequest));
router.put("/:id/reject", wrap(permintaanStokController.rejectRequest));

module.exports = router;
