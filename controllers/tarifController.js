const Tarif = require("../models/tarifModel");
const redis = require("../utils/redisClient");

const tenantKeyList = (tenantID) => `tarifs:tenant:${tenantID}`;
const tenantKeyDetail = (tenantID, tarifID) => `tarif:tenant:${tenantID}:${tarifID}`;

exports.createTarif = async (req, res) => {
  try {
    const { namaTarif, basisPerhitungan, harga, durasiMinimum, tenantID } =
      req.body;

    if (
      !namaTarif ||
      !basisPerhitungan ||
      !harga ||
      !durasiMinimum ||
      !tenantID
    ) {
      return res.status(400).json({ message: "Semua field wajib ada" });
    }

    const newTarif = new Tarif({
      namaTarif,
      basisPerhitungan,
      harga,
      durasiMinimum,
      tenantID,
    });

    await newTarif.save();
    await redis.del(tenantKeyList(tenantID));

    res.status(201).json({ message: "Tarif berhasil dibuat", data: newTarif });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllTarif = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan" });
    }

    const cacheKey = tenantKeyList(tenantID);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const tarifs = await Tarif.find({ tenantID }).populate(
      "tenantID",
      "namaToko status"
    );

    await redis.setEx(cacheKey, 60, JSON.stringify(tarifs));

    res.json(tarifs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTarifById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan" });
    }

    const cacheKey = tenantKeyDetail(tenantID, id);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const found = await Tarif.findOne({ _id: id, tenantID }).populate(
      "tenantID",
      "namaToko status"
    );

    if (!found) {
      return res.status(404).json({ message: "Tarif tidak ditemukan" });
    }

    await redis.setEx(cacheKey, 60, JSON.stringify(found));

    res.json(found);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTarif = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib dikirimkan" });
    }

    const updateFields = {};
    const allowFields = [
      "namaTarif",
      "basisPerhitungan",
      "harga",
      "durasiMinimum",
    ];

    allowFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    if (req.body.tipeAsetID) {
      updateFields.$addToSet = {
        tipeAsetID: { $each: req.body.tipeAsetID },
      };
    }

    const updated = await Tarif.findOneAndUpdate(
      { _id: id, tenantID },
      updateFields,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Tarif tidak ditemukan untuk tenant ini",
      });
    }

    // konsisten pakai helper key
    await redis.del(tenantKeyList(tenantID));
    await redis.del(tenantKeyDetail(tenantID, id));

    res.json({
      message: "Tarif berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTarif = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan" });
    }

    const deletedTarif = await Tarif.findOneAndDelete({ _id: id, tenantID });

    if (!deletedTarif) {
      return res.status(404).json({ message: "Tarif tidak ditemukan" });
    }

    await redis.del(tenantKeyList(tenantID));
    await redis.del(tenantKeyDetail(tenantID, id));

    res.json({ message: "Tarif berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
