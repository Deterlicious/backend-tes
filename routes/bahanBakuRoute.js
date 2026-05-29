const express = require("express");
const router = express.Router();
const bahanBakuController = require("../controllers/bahanBakuController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", checkPermission("create-bahan"), wrap(bahanBakuController.createBahanBaku));
router.get("/", checkPermission("read-bahan"), wrap(bahanBakuController.getBahanBakus));
router.get("/:id", checkPermission("read-bahan"), wrap(bahanBakuController.getBahanBakuById));
router.put("/:id", checkPermission("update-bahan"), wrap(bahanBakuController.updateBahanBaku));
router.delete("/:id", checkPermission("delete-bahan"), wrap(bahanBakuController.deleteBahanBaku));

module.exports = router;
