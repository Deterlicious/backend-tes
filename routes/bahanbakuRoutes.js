const express = require('express');
const router = express.Router();
const bahanBakuController = require('../controllers/bahanbakuController');


router.post('/', bahanBakuController.tambahBahanBaku);// CREATE
router.get('/', bahanBakuController.getAllBahanBaku);// READ ALL
router.get('/:id', bahanBakuController.getBahanBakuById);// READ BY ID
router.put('/:id', bahanBakuController.updateBahanBaku);// UPDATE
router.delete('/:id', bahanBakuController.hapusBahanBaku);// DELETE

module.exports = router;
