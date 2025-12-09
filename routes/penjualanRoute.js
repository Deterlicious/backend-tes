const express = require("express");
const router = express.Router();
const controller = require("../controllers/penjualanController");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(controller, req, res, next)).catch(next);
};

router.post("/", wrap(controller.create));
router.get("/", wrap(controller.getAll));
router.get("/:id", wrap(controller.getById));
router.put("/:id", wrap(controller.update));
router.delete("/:id", wrap(controller.delete));

module.exports = router;