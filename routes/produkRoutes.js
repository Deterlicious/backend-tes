const express = require('express');
const router = express.Router();
const produkController = require('../controllers/produkController');

//route produk
router.post('/', produkController.tambahProduk);
router.get('/', produkController.getAllProduk);
router.get('/:produkID', produkController.getProdukById);
router.put('/:produkID', produkController.updateProduk);
router.delete('/:produkID', produkController.hapusProduk);


module.exports = router;
