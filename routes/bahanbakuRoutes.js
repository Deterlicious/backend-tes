const express = require("express");
const router = express.Router();
const bahanBakuController = require("../controllers/bahanBakuController");

// CRUD Routes
router.post("/", bahanBakuController.tambahBahanBaku);
router.get("/", bahanBakuController.getAllBahanBaku); // gunakan ?tenantID= di sini
router.get("/:id", bahanBakuController.getBahanBakuById);
router.put("/:id", bahanBakuController.updateBahanBaku);
router.delete("/:id", bahanBakuController.hapusBahanBaku);

module.exports = router;
