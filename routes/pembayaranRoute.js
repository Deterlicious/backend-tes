const express = require('express');
const router = express.Router();
const pembayaranController = require('../controllers/pembayaranController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(pembayaranController.createPembayaran)
    .get(pembayaranController.getAllPembayaran); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(pembayaranController.getPembayaranById)
    .put(pembayaranController.updatePembayaran)
    .delete(pembayaranController.deletePembayaran);

module.exports = router;