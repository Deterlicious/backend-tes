const express = require('express');
const router = express.Router();
const produkController = require('../controllers/produkController');

//route produk
router.post('/', produkController.tambahProduk);
router.get('/', produkController.getAllProduk);
router.get('/:id', produkController.getProdukById);
router.put('/:id', produkController.updateProduk);
router.delete('/:id', produkController.hapusProduk);


module.exports = router;
