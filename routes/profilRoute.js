const express = require("express");
const router = express.Router();
const profilController = require("../controllers/profilController");

router.post("/", profilController.createProfil);
router.get("/", profilController.getAllProfil);
router.get("/:id", profilController.getProfilById);
router.put("/:id", profilController.updateProfil);
router.delete("/:id", profilController.deleteProfil);

module.exports = router;
