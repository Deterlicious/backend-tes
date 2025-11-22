const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController'); // Sesuaikan path

// Route untuk CREATE dan READ ALL
router.route('/')
    .post(membershipController.createMembership)
    .get(membershipController.getAllMembership); // Wajib filter tenantID

// Route untuk READ BY ID, UPDATE, dan DELETE
router.route('/:id')
    .get(membershipController.getMembershipById)
    .put(membershipController.updateMembership)
    .delete(membershipController.deleteMembership);

module.exports = router;