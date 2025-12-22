const bebanOperasionalService = require("../services/bebanOperasionalService");
const createError = require("http-errors");

class BebanOperasionalController {
  // --- CREATE ---
  async createBebanOperasional(req, res, next) {
    try {
      /**
       * 🔐 KEAMANAN: Injeksi data dari token (req.pengguna).
       * tenantID: Memastikan transaksi tercatat di tenant yang benar.
       * dicatatOleh: Otomatis mengambil ID akun yang sedang login.
       */
      const payload = {
        ...req.body,
        tenantID: req.pengguna.tenantID,
        dicatatOleh: req.pengguna._id, //default dari mongoDB itu _id bukan id
      };

      // console.log("Payload yang dikirim ke Service:", payload); // debugging isi payload
      const newBeban = await bebanOperasionalService.create(payload);

      res.status(201).json({
        success: true,
        message: "Beban Operasional berhasil ditambahkan",
        data: newBeban,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ ALL ---
  async getAllBebanOperasional(req, res, next) {
    try {
      // Mengambil tenantID murni dari token untuk mencegah lintas data tenant
      const tenantID = req.pengguna.tenantID;

      const bebanOperasional = await bebanOperasionalService.getAll(tenantID);

      res.status(200).json({
        success: true,
        total: bebanOperasional.length,
        data: bebanOperasional,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- READ BY ID ---
  async getBebanOperasionalById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      // Service akan memvalidasi apakah ID tersebut milik tenantID yang login
      const beban = await bebanOperasionalService.getById(id, tenantID);

      res.status(200).json({
        success: true,
        data: beban,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- UPDATE ---
  async updateBebanOperasional(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const updatedBeban = await bebanOperasionalService.update(
        id,
        tenantID,
        req.body
      );

      res.status(200).json({
        success: true,
        message: "Beban Operasional berhasil diperbarui",
        data: updatedBeban,
      });
    } catch (err) {
      next(err);
    }
  }

  // --- DELETE ---
  async deleteBebanOperasional(req, res, next) {
    try {
      const { id } = req.params;
      const tenantID = req.pengguna.tenantID;

      const result = await bebanOperasionalService.delete(id, tenantID);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BebanOperasionalController();
