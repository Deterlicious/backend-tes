const Kategori = require("../models/kategoriModel");

// ✅ Tambah Kategori
exports.createKategori = async (req, res) => {
  try {
    const kategori = await Kategori.create(req.body);
    res.status(201).json({
      message: "Kategori berhasil ditambahkan",
      data: kategori,
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal menambahkan kategori",
      error: error.message,
    });
  }
};

// ✅ Tampilkan semua kategori (Dimodifikasi: Wajib menyertakan tenantID)
exports.getAllKategori = async (req, res) => {
  try {
    // Ambil tenantID dari query parameters (contoh: /api/kategori?tenantID=someTenantId)
    const { tenantID } = req.query;

    // 🛑 Validasi: Pastikan tenantID ada di query parameter
    if (!tenantID) {
      return res.status(400).json({
        message: "Parameter tenantID wajib disertakan di query.",
      });
    }

    // 🔍 Cari kategori berdasarkan tenantID dan lakukan populate
    const kategori = await Kategori.find({ tenantID })
      .populate("tenantID")
      .sort({ createdAt: -1 }); // Opsional: Menambahkan sorting agar konsisten dengan contoh Anda

    // 🚫 Periksa jika tidak ada data ditemukan
    if (kategori.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data kategori untuk tenant ini.",
        data: [],
      });
    }

    // ✅ Kirim data yang ditemukan
    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data kategori",
      error: error.message,
    });
  }
};

// ✅ Tampilkan kategori berdasarkan ID
exports.getKategoriById = async (req, res) => {
  try {
    const kategori = await Kategori.findById(req.params.id).populate(
      "tenantID"
    );
    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json(kategori);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data kategori",
      error: error.message,
    });
  }
};

// ✅ Update kategori
exports.updateKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json({
      message: "Kategori berhasil diperbarui",
      data: kategori,
    });
  } catch (error) {
    res.status(400).json({
      message: "Gagal memperbarui kategori",
      error: error.message,
    });
  }
};

// ✅ Hapus kategori
exports.deleteKategori = async (req, res) => {
  try {
    const kategori = await Kategori.findByIdAndDelete(req.params.id);
    if (!kategori) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }
    res.status(200).json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus kategori",
      error: error.message,
    });
  }
};
