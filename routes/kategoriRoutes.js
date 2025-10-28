const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController');

// CRUD routes
router.post('/', kategoriController.tambahKategori);      // CREATE
router.get('/', kategoriController.getAllKategori);       // READ ALL
router.get('/:kategoriID', kategoriController.getKategoriById);   // READ BY ID
router.put('/:kategoriID', kategoriController.updateKategori);    // UPDATE
router.delete('/:kategoriID', kategoriController.hapusKategori);  // DELETE

module.exports = router;
