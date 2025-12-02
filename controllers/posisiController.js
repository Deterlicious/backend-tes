const Posisi = require("../models/posisiModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyPosisiList = (tenantID) => `posisi:tenant:${tenantID}`;
const keyPosisiDetail = (id) => `posisi:detail:${id}`;

exports.createPosisi = async (req, res) => {
  try {
    const { namaPosisi, deskripsi, tenantID, status } = req.body;

    // 1. Validasi Input
    if (!namaPosisi || !deskripsi || !tenantID) {
      return res
        .status(400)
        .json({ message: "namaPosisi, deskripsi, dan tenantID wajib diisi" });
    }

    if (!isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Format tenantID tidak valid" });
    }

    const newPosisi = new Posisi({
      namaPosisi,
      deskripsi,
      tenantID,
      status: status || "Aktif",
    });

    await newPosisi.save();

    // 2. Cache Invalidation
    await redis.del(keyPosisiList(tenantID));

    res.status(201).json(newPosisi);
  } catch (error) {
    // Handle duplicate entry error (dari unique index)
    if (error.code === 11000) {
      return res.status(400).json({ message: "Nama posisi ini sudah ada di tenant tersebut." });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPosisi = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan dalam query params" });
    }

    // 1. Cek Cache
    const cacheKey = keyPosisiList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const posisi = await Posisi.find({ tenantID })
        .populate("tenantID", "namaToko status")
        .sort({ namaPosisi: 1 });

    // 3. Simpan Cache
    await redis.setEx(cacheKey, 3600, JSON.stringify(posisi)); // Expire 1 jam karena jarang berubah

    res.json(posisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPosisiById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid" });
    }

    // 1. Cek Cache
    const cacheKey = keyPosisiDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const posisi = await Posisi.findById(id).populate("tenantID");

    if (!posisi)
      return res.status(404).json({ message: "Posisi tidak ditemukan" });

    // 3. Simpan Cache
    await redis.setEx(cacheKey, 3600, JSON.stringify(posisi));

    res.json(posisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePosisi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid" });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["namaPosisi", "deskripsi", "status"];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
        if(allowedUpdates.includes(key)) {
            updates[key] = req.body[key];
        }
    });

    if (updates.status && !["Aktif", "Non-Aktif"].includes(updates.status)) {
        return res.status(400).json({ message: "Status tidak valid" });
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // 2. Update DB
    const posisi = await Posisi.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!posisi)
      return res.status(404).json({ message: "Posisi tidak ditemukan" });

    // 3. Cache Invalidation
    await redis.del(keyPosisiDetail(id));
    await redis.del(keyPosisiList(posisi.tenantID));

    res.json(posisi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePosisi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid" });
    }

    const posisi = await Posisi.findById(id);
    if (!posisi) return res.status(404).json({ message: "Posisi tidak ditemukan" });

    // 1. Hapus DB
    await Posisi.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyPosisiDetail(id));
    await redis.del(keyPosisiList(posisi.tenantID));

    res.json({ message: "Posisi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};