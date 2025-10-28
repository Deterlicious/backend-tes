const express = require('express');
const router = express.Router();
const bahanBakuController = require('../controllers/bahanbakuController');


router.post('/', bahanBakuController.tambahBahanBaku);// CREATE
router.get('/', bahanBakuController.getAllBahanBaku);// READ ALL
router.get('/:BahanBakuID', bahanBakuController.getBahanBakuById);// READ BY ID
router.put('/:BahanBakuID', bahanBakuController.updateBahanBaku);// UPDATE
router.delete('/:id', bahanBakuController.hapusBahanBaku);// DELETE

module.exports = router;
