const express = require('express');
const router = express.Router();
const paketMembershipController = require('../controllers/paketMembershipController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(paketMembershipController.createPaketMembership)
    .get(paketMembershipController.getAllPaketMembership); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(paketMembershipController.getPaketMembershipById)
    .put(paketMembershipController.updatePaketMembership)
    .delete(paketMembershipController.deletePaketMembership);

module.exports = router;