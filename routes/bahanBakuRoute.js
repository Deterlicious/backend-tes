const express = require("express");
const router = express.Router();
const bahanBakuController = require("../controllers/bahanBakuController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", checkPermission("kelola-bahan"), wrap(bahanBakuController.createBahanBaku));
router.get("/", checkPermission("kelola-bahan"), wrap(bahanBakuController.getBahanBakus));
router.get("/:id", checkPermission("kelola-bahan"), wrap(bahanBakuController.getBahanBakuById));
router.put("/:id", checkPermission("kelola-bahan"), wrap(bahanBakuController.updateBahanBaku));
router.delete("/:id", checkPermission("kelola-bahan"), wrap(bahanBakuController.deleteBahanBaku));

module.exports = router;
