const produkService = require("../services/produkService");
const { validateProdukPayload } = require("../validators/produkValidator");
const createError = require("http-errors");

class ProdukController {
  async getAll(req, res) {
    // Konsisten: Ambil tenantID dari req.pengguna
    const { tenantID } = req.pengguna;
    const data = await produkService.getAll(tenantID);

    res.status(200).json({ success: true, data });
  }

  async getById(req, res) {
    const { tenantID } = req.pengguna;
    const { id } = req.params;

    const data = await produkService.getById(id, tenantID);
    if (!data) throw createError(404, "Produk tidak ditemukan.");

    res.status(200).json({ success: true, data });
  }

  async create(req, res) {
    const payload = {
      ...req.body,
      tenantID: req.pengguna.tenantID,
    };
    const validation = validateProdukPayload(payload);
    if (!validation.valid) {
      throw createError(400, validation.errors.join(", "));
    }

    const data = await produkService.create(payload);
    res.status(201).json({ success: true, data });
  }

  async update(req, res) {
    const { tenantID } = req.pengguna;
    const { id } = req.params;

    const data = await produkService.update(id, req.body, tenantID);
    if (!data) throw createError(404, "Produk tidak ditemukan.");

    res.status(200).json({ success: true, data });
  }

  async delete(req, res) {
    const { tenantID } = req.pengguna;
    const { id } = req.params;

    const result = await produkService.delete(id, tenantID);

    // Mengikuti style unassign di ProdukPajak
    res.status(200).json({ success: true, ...result });
  }
}

module.exports = new ProdukController();
