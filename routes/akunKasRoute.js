const express = require('express');
const router = express.Router();
const akunKasController = require('../controllers/akunKasController');

router.post('/', akunKasController.createAkunKas);
router.get('/', akunKasController.getAllAkunKas);
router.get('/:id', akunKasController.getAkunKasById);
router.put('/:id', akunKasController.updateAkunKas);
router.delete('/:id', akunKasController.deleteAkunKas);

module.exports = router;