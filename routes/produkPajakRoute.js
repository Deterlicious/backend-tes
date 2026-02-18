const express = require("express");
const router = express.Router();
const produkPajakController = require("../controllers/produkPajakController");
const authPengguna = require("../middleware/authPengguna");

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authPengguna);

// Endpoint untuk menempelkan pajak ke produk
router.post("/", wrap(produkPajakController.assign));

// Endpoint untuk melihat pajak apa saja yang ada di produk tersebut
router.get("/:produkID", wrap(produkPajakController.getByProduk));

// Endpoint untuk melepas pajak dari produk
router.delete("/:id", wrap(produkPajakController.unassign));

module.exports = router;
