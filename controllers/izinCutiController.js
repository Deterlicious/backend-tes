const IzinCuti = require("../models/izinCutiModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient"); 

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyIzinList = (tenantID) => `izincuti:tenant:${tenantID}`;
const keyIzinDetail = (id) => `izincuti:detail:${id}`;

exports.createIzinCuti = async (req, res) => {
  try {
    const {
      penggunaID,
      tanggalMulai,
      tanggalSelesai,
      tipe,
      status,
      keterangan,
      dicatatOleh,
      tenantID,
    } = req.body;

    // 1. Validasi Input Wajib
    if (!penggunaID || !tanggalMulai || !tanggalSelesai || !tipe || !keterangan || !tenantID) {
      return res.status(400).json({
        message: "Data wajib tidak lengkap (penggunaID, tanggal, tipe, keterangan, tenantID)",
      });
    }

    // 2. Validasi ObjectId
    if (!isValidObjectId(penggunaID) || !isValidObjectId(tenantID)) {
      return res.status(400).json({ message: "Format ID Pengguna atau Tenant tidak valid." });
    }
    if (dicatatOleh && !isValidObjectId(dicatatOleh)) {
      return res.status(400).json({ message: "Format ID Pencatat tidak valid." });
    }

    // 3. Validasi Tanggal
    const start = new Date(tanggalMulai);
    const end = new Date(tanggalSelesai);
    if (end < start) {
      return res.status(400).json({ message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
    }

    // 4. Validasi Enum Tipe
    const validTipe = ["sakit", "izin", "cuti tahunan"];
    if (!validTipe.includes(tipe)) {
      return res.status(400).json({ message: "Tipe izin tidak valid." });
    }

    const newIzinCuti = new IzinCuti({
      penggunaID,
      tanggalMulai,
      tanggalSelesai,
      tipe,
      status: status || "diajukan",
      keterangan,
      dicatatOleh,
      tenantID,
    });

    await newIzinCuti.save();

    // 5. Cache Invalidation
    // Hapus list cache tenant terkait agar data baru muncul
    await redis.del(keyIzinList(tenantID));

    res.status(201).json(newIzinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllIzinCuti = async (req, res) => {
  try {
    // Wajib filter by tenantID untuk keamanan data antar tenant
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan dalam query params." });
    }

    // 1. Cek Redis Cache
    const cacheKey = keyIzinList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const data = await IzinCuti.find({ tenantID })
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama")
      .sort({ createdAt: -1 }); // Urutkan dari yang terbaru

    // 3. Simpan ke Redis (Expire 60 detik)
    await redis.setEx(cacheKey, 60, JSON.stringify(data));

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIzinCutiById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Cek Redis Cache Detail
    const cacheKey = keyIzinDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const izinCuti = await IzinCuti.findById(id)
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email")
      .populate("dicatatOleh", "nama");

    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    // 3. Simpan ke Redis
    await redis.setEx(cacheKey, 60, JSON.stringify(izinCuti));

    res.json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateIzinCuti = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = [
      "tanggalMulai",
      "tanggalSelesai",
      "tipe",
      "status",
      "keterangan",
      "dicatatOleh"
    ];
    const updates = {};
    
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // Validasi Spesifik
    if (updates.status) {
      const validStatus = ["diajukan", "disetujui", "ditolak"];
      if (!validStatus.includes(updates.status)) {
        return res.status(400).json({ message: "Status tidak valid." });
      }
    }

    // Jika tanggal diubah, pastikan validasi logika tanggal tetap jalan
    if (updates.tanggalMulai && updates.tanggalSelesai) {
        if (new Date(updates.tanggalSelesai) < new Date(updates.tanggalMulai)) {
            return res.status(400).json({ message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
        }
    }

    // 2. Update DB
    const izinCuti = await IzinCuti.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate("penggunaID", "nama")
      .populate("dicatatOleh", "nama");

    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    // 3. Cache Invalidation
    await redis.del(keyIzinDetail(id));
    await redis.del(keyIzinList(izinCuti.tenantID));

    res.json(izinCuti);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteIzinCuti = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const izinCuti = await IzinCuti.findById(id);
    if (!izinCuti)
      return res.status(404).json({ message: "Data izin/cuti tidak ditemukan" });

    // 1. Hapus dari DB
    await IzinCuti.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyIzinDetail(id));
    await redis.del(keyIzinList(izinCuti.tenantID));

    res.json({ message: "Data izin/cuti berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};