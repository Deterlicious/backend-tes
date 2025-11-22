const express = require("express");
const router = express.Router();
const izinCutiController = require("../controllers/izinCutiController");

router.post("/", izinCutiController.createIzinCuti);
router.get("/", izinCutiController.getAllIzinCuti);
router.get("/:id", izinCutiController.getIzinCutiById);
router.put("/:id", izinCutiController.updateIzinCuti);
router.delete("/:id", izinCutiController.deleteIzinCuti);

module.exports = router;