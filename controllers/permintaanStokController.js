const permintaanStokService = require("../services/permintaanStokService");

class PermintaanStokController {
  // GET ALL dengan filter status (Opsional)
  async getAllPermintaanStok(req, res, next) {
    try {
      const data = await permintaanStokService.getAll(req.query, req.pengguna);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createPermintaanStok(req, res, next) {
    try {
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
        dimintaOleh: req.pengguna._id,
        status: "SUBMITTED", // Default saat pertama kali buat
      };

      const data = await permintaanStokService.create(payload);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // FUNGSI BARU: Untuk Edit Draft / Grace Period Pending
  async updatePermintaanStok(req, res, next) {
    try {
      const { id } = req.params;
      const data = await permintaanStokService.update(
        id,
        req.pengguna.tenantID,
        req.body,
      );

      res.status(200).json({
        success: true,
        message: "Data berhasil diperbarui",
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async submitRequest(req, res, next) {
    try {
      const { id } = req.params;
      const data = await permintaanStokService.submit(
        id,
        req.pengguna.tenantID,
      );

      res.status(200).json({
        success: true,
        message: `Status berhasil diubah menjadi ${data.status}`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async approveRequest(req, res, next) {
    try {
      const { id } = req.params;
      const result = await permintaanStokService.approve(
        id,
        req.pengguna.tenantID,
        req.pengguna._id,
      );

      // Pastikan result (yang berisi transferID) dikirim langsung di root body
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async rejectRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { alasan } = req.body || {}; // Proteksi jika body kosong

      const data = await permintaanStokService.reject(
        id,
        req.pengguna.tenantID,
        req.pengguna._id,
        alasan,
      );

      return res.status(200).json({ success: true, data }); // Gunakan return
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PermintaanStokController();
