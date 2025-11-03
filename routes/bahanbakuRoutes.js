const express = require("express");
const router = express.Router();
const bahanBakuController = require("../controllers/bahanBakuController");

// CRUD Routes
router.post("/", bahanBakuController.createBahanBaku);
router.get("/", bahanBakuController.getAllBahanBaku);
router.get("/:id", bahanBakuController.getBahanBakuById);
router.put("/:id", bahanBakuController.updateBahanBaku);
router.delete("/:id", bahanBakuController.deleteBahanBaku);

module.exports = router;
