const express = require('express');
const router = express.Router();
const jurnalTransferController = require('../controllers/jurnalTransferController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(jurnalTransferController.createJurnalTransfer)
    .get(jurnalTransferController.getAllJurnalTransfer); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(jurnalTransferController.getJurnalTransferById)
    .put(jurnalTransferController.updateJurnalTransfer)
    .delete(jurnalTransferController.deleteJurnalTransfer);

module.exports = router;