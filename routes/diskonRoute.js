const express = require('express');
const router = express.Router();
const diskonController = require('../controllers/diskonController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(diskonController.createDiskon)
    .get(diskonController.getAllDiskon); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(diskonController.getDiskonById)
    .put(diskonController.updateDiskon)
    .delete(diskonController.deleteDiskon);

module.exports = router;