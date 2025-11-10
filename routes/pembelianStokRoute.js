const express = require('express');
const router = express.Router();
const pembelianStokController = require('../controllers/pembelianStokController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(pembelianStokController.createPembelianStok)
    .get(pembelianStokController.getAllPembelianStok); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(pembelianStokController.getPembelianStokById)
    .put(pembelianStokController.updatePembelianStok)
    .delete(pembelianStokController.deletePembelianStok);

module.exports = router;