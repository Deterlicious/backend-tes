const tipeAset = require("../models/tipeAsetModel");
const redis = require("../utils/redisClient");

const tenantKeyList = (tenantID) => `tipeAsets:tenant:${tenantID}`;
const tenantKeyDetail = (tenantID, tipeAsetID) => `tipeAset:tenant:${tenantID}:${tipeAsetID}`;

const requireTenant = (tenantID, res) => {
  if (!tenantID) {
    res.status(400).json({ message: "tenantID wajib disertakan" });
    return false;
  }
  return true;
};

exports.createTipeAset = async (req, res) => {
  try {
    const { namaTipeAset, deskripsi, tenantID } = req.body;

    if (!namaTipeAset || !tenantID) {
      return res.status(400).json({ message: "Semua field wajib ada" });
    }

    const newTipeAset = new tipeAset({ namaTipeAset, deskripsi, tenantID });
    await newTipeAset.save();

    await redis.del(tenantKeyList(tenantID));

    res.status(201).json({
      message: "Tipe Aset berhasil dibuat",
      data: newTipeAset,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllTipeAset = async (req, res) => {
  try {
    const { tenantID } = req.query;
    if (!requireTenant(tenantID, res)) return;

    const cacheKey = tenantKeyList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const data = await tipeAset
      .find({ tenantID })
      .populate("tenantID", "namaToko status");

    await redis.setEx(cacheKey, 60, JSON.stringify(data));

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTipeAsetById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    if (!requireTenant(tenantID, res)) return;

    const cacheKey = tenantKeyDetail(tenantID, id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const data = await tipeAset
      .findOne({ _id: id, tenantID })
      .populate("tenantID", "namaToko status");

    if (!data) {
      return res.status(404).json({ message: "Tipe Aset tidak ditemukan" });
    }

    await redis.setEx(cacheKey, 60, JSON.stringify(data));

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTipeAset = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    if (!requireTenant(tenantID, res)) return;

    const updateFields = {};
    const allowed = ["namaTipeAset", "deskripsi"];

    allowed.forEach((f) => {
      if (req.body[f] !== undefined) {
        updateFields[f] = req.body[f];
      }
    });

    const updated = await tipeAset.findOneAndUpdate(
      { _id: id, tenantID },
      updateFields,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Tipe Aset tidak ditemukan" });
    }

    await redis.del(tenantKeyList(tenantID));
    await redis.del(tenantKeyDetail(tenantID, id));

    res.json({
      message: "Tipe Aset berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTipeAset = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;
    if (!requireTenant(tenantID, res)) return;

    const deleted = await tipeAset.findOneAndDelete({
      _id: id,
      tenantID,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Tipe Aset tidak ditemukan" });
    }

    await redis.del(tenantKeyList(tenantID));
    await redis.del(tenantKeyDetail(tenantID, id));

    res.json({ message: "Tipe Aset berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
