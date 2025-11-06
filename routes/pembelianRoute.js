const express = require('express');
const router = express.Router();
const pembelianController = require('../controllers/pembelianController');

// === ROUTES CRUD Pembelian ===

// ➕ CREATE pembelian baru
router.post('/', pembelianController.tambahPembelian);
// 📋 READ semua pembelian
router.get('/', pembelianController.getAllPembelian);
// 🔍 READ pembelian berdasarkan ID
router.get('/:id', pembelianController.getPembelianById);
// ✏️ UPDATE pembelian berdasarkan ID
router.put('/:id', pembelianController.updatePembelian);
// ❌ DELETE pembelian berdasarkan ID
router.delete('/:id', pembelianController.hapusPembelian);

module.exports = router;
