const express = require("express");
const router = express.Router();
const barangInventoryController = require("../controllers/barangInventoryController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", wrap(barangInventoryController.createBarangInventory));
router.get("/", wrap(barangInventoryController.getBarangInventories));
router.get("/:id", wrap(barangInventoryController.getBarangInventoryById));
router.put("/:id", wrap(barangInventoryController.updateBarangInventory));
router.delete("/:id", wrap(barangInventoryController.deleteBarangInventory));

module.exports = router;
