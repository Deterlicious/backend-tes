const express = require('express');
const router = express.Router();
const akunKasController = require('../controllers/akunKasController');

router.post('/', akunKasController.tambahAkunKas);
router.get('/', akunKasController.getAllAkunKas);
router.get('/:akunKasID', akunKasController.getAkunKasById);
router.put('/:akunKasID', akunKasController.updateAkunKas);
router.delete('/:akunKasID', akunKasController.hapusAkunKas);

module.exports = router;