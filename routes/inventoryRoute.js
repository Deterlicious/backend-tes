const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", wrap(inventoryController.createInventory));
router.get("/", wrap(inventoryController.getInventories));
router.get("/:id", wrap(inventoryController.getInventoryById));
router.put("/:id", wrap(inventoryController.updateInventory));
router.delete("/:id", wrap(inventoryController.deleteInventory));

module.exports = router;
