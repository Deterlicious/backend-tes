const express = require("express");
const router = express.Router();
const pajakController = require("../controllers/pajakController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

router.post("/", wrap(pajakController.createPajak));
router.post("/simulasi", wrap(pajakController.simulasi));
router.get("/", wrap(pajakController.getAllPajak));
router.get("/:id", wrap(pajakController.getPajakById));
router.put("/:id", wrap(pajakController.updatePajak));
router.delete("/:id", wrap(pajakController.deletePajak));

module.exports = router;
