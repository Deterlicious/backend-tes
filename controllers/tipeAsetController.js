const tipeAset = require("../models/tipeAsetModel");
const redis = require("../utils/redisClient");

const tenantKeyList = (tenantID) => `tipeAsets:tenant:${tenantID}`;
const tenantKeyDetail = (tenantID, tipeAsetID) =>
  `tipeAset:tenant:${tenantID}:${tipeAsetID}`;

exports.createTipeAset = async (req, res) => {
  try {
    const { namaTipeAset, deskripsi, tenantID } = req.body;

    if (!namaTipeAset || !tenantID) {
      return res.status(400).json({ message: "Semua field wajib ada" });
    }

    const newTipeAset = new tipeAset({
      namaTipeAset,
      deskripsi,
      tenantID,
    });
    await newTipeAset.save();

    await redis.del(tenantKeyList(tenantID));

    res
      .status(201)
      .json({ message: "Tipe Aset berhasil dibuat", data: newTipeAset });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllTipeAset = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan" });
    }

    const cacheKey = tenantKeyList(tenantID);
    const cachedTipeAsets = await redis.get(cacheKey);

    if (cachedTipeAsets) {
      return res.json(JSON.parse(cachedTipeAsets));
    }
    const tipeAsets = await tipeAset
      .find({ tenantID })
      .populate("tenantID", "namaToko status");
    await redis.setEx(cacheKey, 60, JSON.stringify(tipeAsets));

    res.json(tipeAsets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTipeAsetById = async (req, res) => {
  try {
    const { tenantID, tipeAsetID } = req.params;

    const cacheKey = tenantKeyDetail(tenantID, tipeAsetID);
    const cachedTipeAset = await redis.get(cacheKey);
    if (cachedTipeAset) {
      return res.json(JSON.parse(cachedTipeAset));
    }

    const tipeAsetData = await tipeAset
      .findOne({ _id: tipeAsetID, tenantID })
      .populate("tenantID", "namaToko status");
    if (!tipeAsetData) {
      return res.status(404).json({ message: "Tipe Aset tidak ditemukan" });
    }

    await redis.setEx(cacheKey, 60, JSON.stringify(tipeAsetData));

    res.json(tipeAsetData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTipeAset = async (req, res) => {
  try {
    const { tipeAsetID } = req.params;
    const { namaTipeAset, deskripsi, tenantID } = req.body;

    const updatedTipeAset = await tipeAset.findOneAndUpdate(
      { _id: tipeAsetID, tenantID },
      { namaTipeAset, deskripsi },
      { new: true }
    );

    if (!updatedTipeAset) {
      return res.status(404).json({ message: "Tipe Aset tidak ditemukan" });
    }
    await redis.del(tenantKeyList(tenantID));
    await redis.del(tenantKeyDetail(tenantID, tipeAsetID));

    res.json({
      message: "Tipe Aset berhasil diperbarui",
      data: updatedTipeAset,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTipeAset = async (req, res) => {
  try {
    const { tipeAsetID } = req.params;
    const { tenantID } = req.body;

    const deletedTipeAset = await tipeAset.findOneAndDelete({
      _id: tipeAsetID,
      tenantID,
    });
    if (!deletedTipeAset) {
      return res.status(404).json({ message: "Tipe Aset tidak ditemukan" });
    }
    await redis.del(tenantKeyList(tenantID));
    await redis.del(tenantKeyDetail(tenantID, tipeAsetID));

    res.json({ message: "Tipe Aset berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
