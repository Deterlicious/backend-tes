const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const authPengguna = require("../middleware/authPengguna");

// Helper untuk menangani error asinkron
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Middleware proteksi (Memastikan req.pengguna terisi)
router.use(authPengguna);

// --- CRUD STANDAR ---
router.post("/", wrap(inventoryController.createInventory));
router.get("/", wrap(inventoryController.getInventories));
router.get("/:id", wrap(inventoryController.getInventoryById));
router.put("/:id", wrap(inventoryController.updateInventory));
router.delete("/:id", wrap(inventoryController.deleteInventory));

// --- FITUR KHUSUS WMS (TAMBAHAN BARU) ---
/** * POST /api/inventory/:id/opname
 * Digunakan untuk penyesuaian stok fisik (mencatat selisih ke JurnalStok)
 */
router.post("/:id/opname", wrap(inventoryController.submitOpname));
/** * PATCH /api/inventory/:id/minimum-stok
 * Digunakan untuk memperbarui batas stok aman
 */
router.patch("/:id/minimum-stok", wrap(inventoryController.updateMinimumStok));
/** * POST /api/inventory/process-sale
 * Digunakan oleh modul penjualan untuk memotong stok berdasarkan resep produk
 */
router.post("/process-sale", wrap(inventoryController.processSale));

module.exports = router;
