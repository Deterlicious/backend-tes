const express = require("express");
const router = express.Router();
const posisiController = require("../controllers/posisiController");

router.post("/", posisiController.createPosisi);
router.get("/", posisiController.getAllPosisi);
router.get("/:id", posisiController.getPosisiById);
router.put("/:id", posisiController.updatePosisi);
router.delete("/:id", posisiController.deletePosisi);

module.exports = router;