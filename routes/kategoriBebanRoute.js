const express = require('express');
const router = express.Router();
const kategoriBebanController = require('../controllers/kategoriBebanController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(kategoriBebanController.createKategoriBeban)
    .get(kategoriBebanController.getAllKategoriBeban); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(kategoriBebanController.getKategoriBebanById)
    .put(kategoriBebanController.updateKategoriBeban)
    .delete(kategoriBebanController.deleteKategoriBeban);

module.exports = router;