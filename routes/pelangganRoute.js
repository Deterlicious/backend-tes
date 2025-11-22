const express = require('express');
const router = express.Router();
const pelangganController = require('../controllers/pelangganController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(pelangganController.createPelanggan)
    .get(pelangganController.getAllPelanggan); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(pelangganController.getPelangganById)
    .put(pelangganController.updatePelanggan)
    .delete(pelangganController.deletePelanggan);

module.exports = router;