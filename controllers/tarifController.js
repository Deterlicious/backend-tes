const tarif = require("../models/tarifModel");
const redis = require("../utils/redisClient");

const tenantKeyList = (tenantID) => `tarifs:tenant:${tenantID}`;
const tenantKeyDetail = (tenantID, tarifID) =>
  `tarif:tenant:${tenantID}:${tarifID}`;

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
    const newTarif = new tarif({
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
    const cachedTarifs = await redis.get(cacheKey);

    if (cachedTarifs) {
      return res.json(JSON.parse(cachedTarifs));
    }

    const tarifs = await tarif
      .find({ tenantID })
      .populate("tenantID", "namaToko status");

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
    const cachedTarif = await redis.get(cacheKey);

    if (cachedTarif) {
      return res.json(JSON.parse(cachedTarif));
    }

    const foundTarif = await tarif
      .findOne({ _id: id, tenantID })
      .populate("tenantID", "namaToko status");
    if (!foundTarif) {
      return res.status(404).json({ message: "Tarif tidak ditemukan" });
    }

    await redis.setEx(cacheKey, 60, JSON.stringify(foundTarif));

    res.json(foundTarif);
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

    // data yang bisa diupdate biasa
    const updateFields = {};
    const allowFields = ["namaTarif", "basisPerhitungan", "harga", "durasiMinimum"];

    allowFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    // jika ingin menambah tipeAsetID (array)
    if (req.body.tipeAsetID) {
      updateFields.$addToSet = {
        tipeAsetID: { $each: req.body.tipeAsetID }
      };
    }

    const updatedTarif = await tarif.findOneAndUpdate(
      { _id: id, tenantID },   // pastikan tarif milik tenant yg benar
      updateFields,
      { new: true }
    );

    if (!updatedTarif) {
      return res.status(404).json({ message: "Tarif tidak ditemukan untuk tenant ini" });
    }

    // invalidasi cache redis jika Anda gunakan
    if (redis) {
      await redis.del(`tarif:${id}`);
      await redis.del(`tarif:tenant:${tenantID}`);
    }

    res.json({
      message: "Tarif berhasil diperbarui",
      data: updatedTarif
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.deleteTarif = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTarif = await tarif.findByIdAndDelete(id);

    if (!deletedTarif) {
      return res.status(404).json({ message: "Tarif tidak ditemukan" });
    }

    res.json({ message: "Tarif berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
