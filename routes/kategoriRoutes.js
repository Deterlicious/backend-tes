const express = require("express");
const router = express.Router();
const kategoriController = require("../controllers/kategoriController");

// Endpoint CRUD
router.post("/", kategoriController.createKategori);
router.get("/", kategoriController.getAllKategori);
router.get("/:id", kategoriController.getKategoriById);
router.put("/:id", kategoriController.updateKategori);
router.delete("/:id", kategoriController.deleteKategori);

module.exports = router;