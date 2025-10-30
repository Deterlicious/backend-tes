const express = require("express");
const router = express.Router();
const penggunaController = require("../controllers/penggunaController");

router.post("/", penggunaController.createPengguna);
router.get("/", penggunaController.getAllPengguna);
router.get("/:id", penggunaController.getPenggunaById);
router.put("/:id", penggunaController.updatePengguna);
router.delete("/:id", penggunaController.deletePengguna);

module.exports = router;
