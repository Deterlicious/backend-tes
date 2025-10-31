const express = require('express');
const router = express.Router();
const penjualanController = require('../controllers/penjualanController');

router.post('/', penjualanController.createPenjualan);
router.get('/', penjualanController.getAllPenjualan);
router.get('/:id', penjualanController.getPenjualanById);
router.put('/:id', penjualanController.updatePenjualan);
router.delete('/:id', penjualanController.deletePenjualan);

module.exports = router;
    