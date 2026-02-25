const express = require("express");
const router = express.Router();
const produkPajakController = require("../controllers/produkPajakController");
const authPengguna = require("../middleware/authPengguna");
const {
  validateProdukPajakPayload,
} = require("../validators/produkPajakValidator");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Middleware validasi (Mengikuti style tim kamu)
const validateAssign = (req, res, next) => {
  const result = validateProdukPajakPayload(req.body);
  if (!result.valid)
    return res.status(400).json({ success: false, errors: result.errors });
  next();
};

router.use(authPengguna);

// Endpoint untuk menempelkan pajak ke produk ATAU asset
router.post("/", validateAssign, wrap(produkPajakController.assign));

// Endpoint untuk melihat pajak berdasarkan targetID (Bisa produkID atau assetID)
// Nama parameter diubah menjadi :targetID agar sesuai dengan method getByTarget di Controller
router.get("/:targetID", wrap(produkPajakController.getByTarget));

// Endpoint untuk melepas pajak dari item (berdasarkan ID relasi ProdukPajak)
router.delete("/:id", wrap(produkPajakController.unassign));

module.exports = router;
