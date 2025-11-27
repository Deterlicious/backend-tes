const express = require("express");
const router = express.Router();
const tarifController = require("../controllers/tarifController");

router.post("/", tarifController.createTarif);
router.get("/", tarifController.getAllTarif);
router.get("/:id", tarifController.getTarifById);
router.put("/:id", tarifController.updateTarif);
router.delete("/:id", tarifController.deleteTarif);

module.exports = router;
