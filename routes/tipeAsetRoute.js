const express = require("express");
const router = express.Router();
const tipeAsetController = require("../controllers/tipeAsetController");

router.post("/", tipeAsetController.createTipeAset);
router.get("/", tipeAsetController.getAllTipeAset);
router.get("/:id", tipeAsetController.getTipeAsetById);
router.put("/:id", tipeAsetController.updateTipeAset);
router.delete("/:id", tipeAsetController.deleteTipeAset);

module.exports = router;