const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Helper untuk menangani error asinkron
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Middleware proteksi (Memastikan req.pengguna terisi)
router.use(authPengguna);

// --- CRUD STANDAR ---
router.post("/", checkPermission("create-inventory"), wrap(inventoryController.createInventory));
router.get(
  "/",
  checkPermission("read-inventory", "read-inventory-gudang", "read-inventory-outlet"),
  wrap(inventoryController.getInventories),
);
router.get(
  "/:id",
  checkPermission("read-inventory", "read-inventory-gudang", "read-inventory-outlet"),
  wrap(inventoryController.getInventoryById),
);
router.delete("/:id", checkPermission("delete-inventory"), wrap(inventoryController.deleteInventory));

// --- FITUR KHUSUS WMS (TAMBAHAN BARU) ---
/** * POST /api/inventory/:id/opname
 * Digunakan untuk penyesuaian stok fisik (mencatat selisih ke JurnalStok)
 */
router.post(
  "/:id/opname",
  checkPermission("opname-inventory"),
  wrap(inventoryController.submitOpname),
);
/** * PATCH /api/inventory/:id/minimum-stok
 * Digunakan untuk memperbarui batas stok aman
 */
router.patch(
  "/:id/minimum-stok",
  checkPermission("update-inventory-minimum"),
  wrap(inventoryController.updateMinimumStok),
);
/** * POST /api/inventory/process-sale
 * Digunakan oleh modul penjualan untuk memotong stok berdasarkan resep produk
 */
router.post(
  "/process-sale",
  checkPermission("akses-pos"),
  wrap(inventoryController.processSaleStock),
);

module.exports = router;
