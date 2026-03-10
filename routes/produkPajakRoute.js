const express = require("express");
const router = express.Router();

const produkPajakController = require("../controllers/produkPajakController");
const authPengguna = require("../middleware/authPengguna");
const { validateProdukPajakPayload } = require("../validators/produkPajakValidator");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const validateAssign = (req, res, next) => {
  const result = validateProdukPajakPayload(req.body);

  if (!result.valid) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
    });
  }

  next();
};

router.use(authPengguna);

router.post("/", validateAssign, wrap(produkPajakController.assign));
router.get("/:targetID", wrap(produkPajakController.getByTarget));
router.delete("/:id", wrap(produkPajakController.unassign));

module.exports = router;