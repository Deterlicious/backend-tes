const express = require('express');
const router = express.Router();
const jurnalStokController = require('../controllers/jurnalStokController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(jurnalStokController.createJurnalStok)
    .get(jurnalStokController.getAllJurnalStok); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(jurnalStokController.getJurnalStokById) // Hanya menggunakan ID
    .put(jurnalStokController.updateJurnalStok) // Hanya menggunakan ID
    .delete(jurnalStokController.deleteJurnalStok); // Hanya menggunakan ID

module.exports = router;