const BahanBaku = require("../models/bahanBakuModel");

// CREATE — Tambah Bahan Baku
exports.tambahBahanBaku = async (req, res) => {
  try {
    const { namaBahan, stok, satuan, tenantID } = req.body;

    if (!namaBahan || !satuan || !tenantID) {
      return res
        .status(400)
        .json({ message: "Field namaBahan, satuan, dan tenantID wajib diisi." });
    }

    const bahanBaru = new BahanBaku({
      namaBahan,
      stok,
      satuan,
      tenantID,
    });

    await bahanBaru.save();
    res.status(201).json({ message: "Bahan baku berhasil ditambahkan", data: bahanBaru });
  } catch (error) {
    res.status(400).json({ message: "Gagal menambah bahan baku", error: error.message });
  }
};

// READ ALL — Filter by tenantID (query parameter)
exports.getAllBahanBaku = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "Parameter tenantID wajib disertakan di query." });
    }

    const bahanBaku = await BahanBaku.find({ tenantID }).sort({ createdAt: -1 });

    if (bahanBaku.length === 0) {
      return res.status(404).json({ message: "Tidak ada data bahan baku untuk tenant ini." });
    }

    res.status(200).json(bahanBaku);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data bahan baku", error: error.message });
  }
};

// READ BY ID
exports.getBahanBakuById = async (req, res) => {
  try {
    const bahan = await BahanBaku.findById(req.params.id);
    if (!bahan) return res.status(404).json({ message: "Bahan baku tidak ditemukan" });
    res.status(200).json(bahan);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil bahan baku", error: error.message });
  }
};

// UPDATE
exports.updateBahanBaku = async (req, res) => {
  try {
    const bahan = await BahanBaku.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!bahan) return res.status(404).json({ message: "Bahan baku tidak ditemukan" });

    res.status(200).json({ message: "Bahan baku berhasil diperbarui", data: bahan });
  } catch (error) {
    res.status(400).json({ message: "Gagal memperbarui bahan baku", error: error.message });
  }
};

// DELETE
exports.hapusBahanBaku = async (req, res) => {
  try {
    const bahan = await BahanBaku.findByIdAndDelete(req.params.id);

    if (!bahan) return res.status(404).json({ message: "Bahan baku tidak ditemukan" });

    res.status(200).json({ message: "Bahan baku berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus bahan baku", error: error.message });
  }
};
