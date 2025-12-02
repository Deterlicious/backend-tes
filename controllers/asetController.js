const Aset = require("../models/asetModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai dengan struktur project Anda
const redis = require("../utils/redisClient"); 

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyAsetList = (tenantID) => `aset:tenant:${tenantID}`;
const keyAsetDetail = (id) => `aset:detail:${id}`;

exports.createAset = async (req, res) => {
  try {
    // 1. Validasi Field & Input (Whitelisting)
    const { namaAset, tipeAsetID, tenantID, status } = req.body;

    if (!namaAset || !tipeAsetID || !tenantID) {
      return res.status(400).json({
        message: "Field wajib tidak boleh kosong: namaAset, tipeAsetID, dan tenantID.",
      });
    }

    if (!isValidObjectId(tipeAsetID) || !isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Format ID (TipeAset atau Tenant) tidak valid." });
    }

    const validStatus = ["tersedia", "digunakan", "perbaikan"];
    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        message: `Status tidak valid. Pilihan: ${validStatus.join(", ")}`,
      });
    }

    // 2. Simpan ke Database
    const newAset = new Aset({
      namaAset,
      tipeAsetID,
      tenantID,
      status: status || "tersedia",
    });

    const savedAset = await newAset.save();

    // 3. Cache Invalidation
    // Hapus cache list aset milik tenant ini agar data baru muncul
    await redis.del(keyAsetList(tenantID));

    res.status(201).json(savedAset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllAset = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan dalam query params" });
    }

    // 1. Cek Cache Redis
    const cacheKey = keyAsetList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    // 2. Ambil dari Database (jika cache miss)
    // Populate tipeAsetID untuk menampilkan detail tipe aset
    const asets = await Aset.find({ tenantID }).populate("tipeAsetID", "namaTipeAset deskripsi");

    // 3. Simpan ke Redis (Expire 60 detik)
    await redis.setEx(cacheKey, 60, JSON.stringify(asets));

    res.status(200).json(asets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAsetById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Aset tidak valid." });
    }

    // 1. Cek Cache Redis Detail
    const cacheKey = keyAsetDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    // 2. Ambil dari Database
    const aset = await Aset.findById(id).populate("tipeAsetID", "namaTipeAset deskripsi");

    if (!aset) return res.status(404).json({ message: "Aset tidak ditemukan" });

    // 3. Simpan ke Redis (Expire 60 detik)
    await redis.setEx(cacheKey, 60, JSON.stringify(aset));

    res.status(200).json(aset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAset = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Aset tidak valid." });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["namaAset", "status", "tipeAsetID", "tenantID"];
    const updates = {};
    
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Validasi input spesifik
    if (updates.status) {
      const validStatus = ["tersedia", "digunakan", "perbaikan"];
      if (!validStatus.includes(updates.status)) {
        return res.status(400).json({ message: "Status tidak valid." });
      }
    }
    if (updates.tipeAsetID && !isValidObjectId(updates.tipeAsetID)) {
      return res.status(400).json({ message: "Format tipeAsetID tidak valid." });
    }
    if (updates.tenantID && !isValidObjectId(updates.tenantID)) {
      return res.status(400).json({ message: "Format tenantID tidak valid." });
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // 2. Update Database
    const updatedAset = await Aset.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedAset)
      return res.status(404).json({ message: "Aset tidak ditemukan" });

    // 3. Cache Invalidation
    // Hapus cache detail aset ini
    await redis.del(keyAsetDetail(id));
    // Hapus cache list tenant terkait (agar perubahan status/nama terlihat di list)
    await redis.del(keyAsetList(updatedAset.tenantID));

    res.status(200).json(updatedAset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteAset = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Aset tidak valid." });
    }

    // Cari dulu untuk mendapatkan tenantID sebelum dihapus (untuk keperluan clear cache)
    const asetToDelete = await Aset.findById(id);

    if (!asetToDelete) {
        return res.status(404).json({ message: "Aset tidak ditemukan" });
    }

    // 1. Hapus dari Database
    await Aset.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyAsetDetail(id));
    await redis.del(keyAsetList(asetToDelete.tenantID));

    res.status(200).json({ message: "Aset berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};