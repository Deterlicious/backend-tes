const AkunKas = require("../models/akunKasModel"); // Sesuaikan path jika perlu

// ✅ Tambah Akun Kas
exports.createAkunKas = async (req, res) => {
  try {
    const akunKas = await AkunKas.create(req.body);
    res.status(201).json({
      message: "Akun Kas berhasil ditambahkan",
      data: akunKas,
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal menambahkan Akun Kas",
      error: error.message,
    });
  }
};

// ✅ Tampilkan semua Akun Kas (WAJIB FILTER berdasarkan tenantID)
exports.getAllAkunKas = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({
        message: "Parameter tenantID wajib disertakan di query.",
      });
    }

    const akunKas = await AkunKas.find({ tenantID }).sort({ createdAt: -1 });

    if (akunKas.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Akun Kas untuk tenant ini.",
      });
    }

    res.status(200).json(akunKas);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Akun Kas",
      error: error.message,
    });
  }
};

// ✅ Tampilkan Akun Kas berdasarkan ID (Disederhanakan: Hanya menggunakan ID dari params)
exports.getAkunKasById = async (req, res) => {
  try {
    const { id } = req.params; // Hanya ambil ID dari route params, hilangkan tenantID dari query

    // Cari berdasarkan _id saja
    const akunKas = await AkunKas.findById(id);

    if (!akunKas) {
      // Ubah pesan error karena kita tidak memfilter berdasarkan tenant lagi
      return res.status(404).json({ message: "Akun Kas tidak ditemukan." });
    }

    res.status(200).json(akunKas);
  } catch (error) {
    // Tangani error jika ID tidak valid (misalnya, bukan format ObjectID yang benar)
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid.",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Gagal mengambil data Akun Kas",
      error: error.message,
    });
  }
};
// ✅ Update Akun Kas
// Tambahkan filter tenantID untuk keamanan
exports.updateAkunKas = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;

    if (!tenantID) {
      return res
        .status(400)
        .json({ message: "Parameter tenantID wajib disertakan di query." });
    }

    const akunKas = await AkunKas.findOneAndUpdate(
      { _id: id, tenantID }, // Filter berdasarkan ID dan tenantID
      req.body,
      { new: true, runValidators: true }
    );

    if (!akunKas) {
      return res
        .status(404)
        .json({
          message: "Akun Kas tidak ditemukan atau Anda tidak memiliki akses.",
        });
    }

    res.status(200).json({
      message: "Akun Kas berhasil diperbarui",
      data: akunKas,
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal memperbarui Akun Kas",
      error: error.message,
    });
  }
};

// ✅ Hapus Akun Kas
// Tambahkan filter tenantID untuk keamanan
exports.deleteAkunKas = async (req, res) => {
  try {
    const { tenantID } = req.query;
    const { id } = req.params;

    if (!tenantID) {
      return res
        .status(400)
        .json({ message: "Parameter tenantID wajib disertakan di query." });
    }

    const akunKas = await AkunKas.findOneAndDelete({ _id: id, tenantID });

    if (!akunKas) {
      return res
        .status(404)
        .json({
          message: "Akun Kas tidak ditemukan atau Anda tidak memiliki akses.",
        });
    }

    res.status(200).json({ message: "Akun Kas berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Akun Kas",
      error: error.message,
    });
  }
};
