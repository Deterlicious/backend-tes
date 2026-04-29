const express = require("express");
const router = express.Router();
const bahanBakuController = require("../controllers/bahanBakuController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", wrap(bahanBakuController.createBahanBaku));
router.get("/", wrap(bahanBakuController.getBahanBakus));
router.get("/:id", wrap(bahanBakuController.getBahanBakuById));
router.put("/:id", wrap(bahanBakuController.updateBahanBaku));
router.delete("/:id", wrap(bahanBakuController.deleteBahanBaku));

module.exports = router;
