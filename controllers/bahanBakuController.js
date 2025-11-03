const BahanBaku = require("../models/bahanBakuModel");

// ✅ CREATE
exports.createBahanBaku = async (req, res) => {
  try {
    const { namaBahan, stok, satuan, tenantID } = req.body;

    if (!namaBahan || !satuan || !tenantID) {
      return res.status(400).json({ message: "namaBahan, satuan, dan tenantID wajib diisi" });
    }

    const bahanBaku = new BahanBaku({
      namaBahan,
      stok,
      satuan,
      tenantID,
    });

    await bahanBaku.save();
    res.status(201).json({ message: "Bahan baku berhasil ditambahkan", data: bahanBaku });
  } catch (error) {
    res.status(500).json({ message: "Gagal menambahkan bahan baku", error: error.message });
  }
};

// ✅ READ ALL
exports.getAllBahanBaku = async (req, res) => {
  try {
    const data = await BahanBaku.find().populate("tenantID", "namaTenant");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data bahan baku", error: error.message });
  }
};

// ✅ READ BY ID
exports.getBahanBakuById = async (req, res) => {
  try {
    const data = await BahanBaku.findById(req.params.id).populate("tenantID", "namaTenant");
    if (!data) {
      return res.status(404).json({ message: "Bahan baku tidak ditemukan" });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil bahan baku", error: error.message });
  }
};

// ✅ UPDATE
exports.updateBahanBaku = async (req, res) => {
  try {
    const { namaBahan, stok, satuan } = req.body;
    const data = await BahanBaku.findByIdAndUpdate(
      req.params.id,
      { namaBahan, stok, satuan },
      { new: true, runValidators: true }
    );

    if (!data) {
      return res.status(404).json({ message: "Bahan baku tidak ditemukan" });
    }

    res.status(200).json({ message: "Bahan baku berhasil diperbarui", data });
  } catch (error) {
    res.status(500).json({ message: "Gagal memperbarui bahan baku", error: error.message });
  }
};

// ✅ DELETE
exports.deleteBahanBaku = async (req, res) => {
  try {
    const data = await BahanBaku.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ message: "Bahan baku tidak ditemukan" });
    }
    res.status(200).json({ message: "Bahan baku berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: "Gagal menghapus bahan baku", error: error.message });
  }
};
