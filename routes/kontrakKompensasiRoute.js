const express = require("express");
const router = express.Router();
const kontrakController = require("../controllers/kontrakKompensasiController");

router.post("/", kontrakController.createKontrak);
router.get("/", kontrakController.getAllKontrak);
router.get("/:id", kontrakController.getKontrakById);
router.put("/:id", kontrakController.updateKontrak);
router.delete("/:id", kontrakController.deleteKontrak);

module.exports = router;