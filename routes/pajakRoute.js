const express = require("express");
const router = express.Router();

const pajakController = require("../controllers/pajakController");
const authPengguna = require("../middleware/authPengguna");
const { validatePajakPayload } = require("../validators/pajakValidator");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const validateCreate = (req, res, next) => {
  const result = validatePajakPayload(req.body);

  if (!result.valid) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
    });
  }

  next();
};

const validateUpdate = (req, res, next) => {
  const result = validatePajakPayload(req.body, true);

  if (!result.valid) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
    });
  }

  next();
};

router.use(authPengguna);

router.post("/", validateCreate, wrap(pajakController.createPajak));
router.post("/simulasi-produk", wrap(pajakController.simulasiProduk));
router.post("/simulasi-transaksi", wrap(pajakController.simulasiTransaksi));
router.get("/", wrap(pajakController.getAllPajak));
router.get("/:id", wrap(pajakController.getPajakById));
router.put("/:id", validateUpdate, wrap(pajakController.updatePajak));
router.delete("/:id", wrap(pajakController.deletePajak));

module.exports = router;
