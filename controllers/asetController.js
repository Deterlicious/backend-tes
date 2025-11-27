const Aset = require("../models/asetModel");
const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createAset = async (req, res) => {
  try {
    const { namaAset, tipeAsetID, tenantID, status } = req.body;

    if (!namaAset || !tipeAsetID || !tenantID) {
      return res.status(400).json({
        message:
          "Field wajib tidak boleh kosong: namaAset, tipeAsetID, dan tenantID.",
      });
    }

    if (!isValidObjectId(tipeAsetID) || !isValidObjectId(tenantID)) {
      return res
        .status(400)
        .json({ message: "Format ID (TipeAset atau Tenant) tidak valid." });
    }

    const validStatus = ["tersedia", "digunakan", "perbaikan"];

    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        message: `Status tidak valid. Pilihan yang diperbolehkan: ${validStatus.join(
          ", "
        )}`,
      });
    }

    const newAset = new Aset(req.body);
    const savedAset = await newAset.save();

    res.status(201).json(savedAset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllAset = async (req, res) => {
  try {
    const { tenantID } = req.query;
    let query = {};

    if (tenantID) {
      query.tenantID = tenantID;
    }

    const asets = await Aset.find(query).populate("tipeAsetID");
    res.status(200).json(asets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAsetById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Format ID Aset tidak valid." });
    }

    const aset = await Aset.findById(req.params.id).populate("tipeAsetID");

    if (!aset) return res.status(404).json({ message: "Aset tidak ditemukan" });

    res.status(200).json(aset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAset = async (req, res) => {
  try {
    const { status, tipeAsetID, tenantID } = req.body;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Format ID Aset tidak valid." });
    }

    const validStatus = ["tersedia", "digunakan", "perbaikan"];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        message: `Status tidak valid. Pilihan yang diperbolehkan: ${validStatus.join(
          ", "
        )}`,
      });
    }

    if (tipeAsetID && !isValidObjectId(tipeAsetID)) {
      return res
        .status(400)
        .json({ message: "Format tipeAsetID tidak valid." });
    }
    if (tenantID && !isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Format tenantID tidak valid." });
    }

    const updatedAset = await Aset.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updatedAset)
      return res.status(404).json({ message: "Aset tidak ditemukan" });

    res.status(200).json(updatedAset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteAset = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Format ID Aset tidak valid." });
    }

    const deletedAset = await Aset.findByIdAndDelete(req.params.id);

    if (!deletedAset)
      return res.status(404).json({ message: "Aset tidak ditemukan" });

    res.status(200).json({ message: "Aset berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};