const express = require('express');
const router = express.Router();
const kategoriController = require('../controllers/kategoriController');

// CRUD routes
router.post('/', kategoriController.tambahKategori);      // CREATE
router.get('/', kategoriController.getAllKategori);       // READ ALL
router.get('/:id', kategoriController.getKategoriById);   // READ BY ID
router.put('/:id', kategoriController.updateKategori);    // UPDATE
router.delete('/:id', kategoriController.hapusKategori);  // DELETE

module.exports = router;
