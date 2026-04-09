const inventoryService = require("../services/inventoryService");

class InventoryController {
  // --- FITUR STANDAR (CRUD) ---

  async createInventory(req, res, next) {
    try {
      const payload = { ...req.body, tenantID: req.pengguna.tenantID };
      const data = await inventoryService.create(payload);
      res
        .status(201)
        .json({ success: true, message: "Inventory berhasil dicatat", data });
    } catch (err) {
      next(err);
    }
  }

  async getInventories(req, res, next) {
    try {
      // Mengirimkan req.query (filter lokasi, dll) dan req.pengguna (tenantID & role)
      const data = await inventoryService.getAll(req.query, req.pengguna);
      res.status(200).json({
        success: true,
        count: data.length,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async getInventoryById(req, res, next) {
    try {
      const data = await inventoryService.getById(
        req.params.id,
        req.pengguna.tenantID,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- FITUR KHUSUS WMS (YANG SUDAH KITA BUAT SEBELUMNYA) ---

  /**
   * Stok Opname: Penyesuaian stok fisik dan pencatatan Jurnal
   * Endpoint: POST /api/inventory/:id/opname
   */
  async submitOpname(req, res, next) {
    try {
      const { id } = req.params;
      // req.pengguna dikirim untuk mendapatkan tenantID dan userID untuk JurnalStok
      const data = await inventoryService.submitOpname(
        id,
        req.body,
        req.pengguna,
      );

      res.status(200).json({
        success: true,
        message: "Stok fisik berhasil diperbarui dan jurnal telah dicatat",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update Minimum Stok: Mengatur batas peringatan stok kritis
   * Endpoint: PATCH /api/inventory/:id/minimum-stok
   */
  async updateMinimumStok(req, res, next) {
    try {
      const { id } = req.params;
      const data = await inventoryService.updateMinimumStok(
        id,
        req.body,
        req.pengguna,
      );

      res.status(200).json({
        success: true,
        message: "Batas stok minimum berhasil diperbarui",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Process Sale Stock: Fitur untuk temanmu (Bagian Penjualan)
   * Menghitung resep dan memotong stok otomatis
   */
  async processSale(req, res, next) {
    try {
      const { produkID, qtyJual, lokasiID } = req.body;
      const { tenantID, _id: userID } = req.pengguna;

      const data = await inventoryService.processSaleStock(
        produkID,
        qtyJual,
        lokasiID,
        tenantID,
        userID,
      );

      res.status(200).json({
        success: true,
        message: "Stok produk dan bahan baku berhasil dipotong",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deleteInventory(req, res, next) {
    try {
      await inventoryService.delete(req.params.id, req.pengguna.tenantID);
      res.status(200).json({ success: true, message: "Inventory dihapus" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InventoryController();
