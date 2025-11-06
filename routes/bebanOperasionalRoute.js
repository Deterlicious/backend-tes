const express = require('express');
const router = express.Router();
const bebanOperasionalController = require('../controllers/bebanOperasionalController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(bebanOperasionalController.createBebanOperasional)
    .get(bebanOperasionalController.getAllBebanOperasional); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(bebanOperasionalController.getBebanOperasionalById)
    .put(bebanOperasionalController.updateBebanOperasional)
    .delete(bebanOperasionalController.deleteBebanOperasional);

module.exports = router;