const KontrakKompensasi = require("../models/kontrakKompensasiModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient"); 

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyKontrakList = (tenantID) => `kontrak:tenant:${tenantID}`;
const keyKontrakDetail = (id) => `kontrak:detail:${id}`;

exports.createKontrak = async (req, res) => {
  try {
    const {
      tenantID,
      penggunaID,
      tipeGaji,
      tarifGaji,
      tanggalMulai,
      tanggalSelesai,
      status,
    } = req.body;

    // 1. Validasi Input Wajib
    if (!tenantID || !penggunaID || !tipeGaji || !tarifGaji || !tanggalMulai) {
      return res.status(400).json({ message: "Data wajib belum lengkap (tenant, pengguna, tipe, tarif, tgl mulai)." });
    }

    // 2. Validasi ObjectId
    if (!isValidObjectId(tenantID) || !isValidObjectId(penggunaID)) {
      return res.status(400).json({ message: "Format ID Tenant atau Pengguna tidak valid." });
    }

    // 3. Validasi Logika Tarif
    if (typeof tarifGaji !== 'number' || tarifGaji < 0) {
      return res.status(400).json({ message: "Tarif gaji harus berupa angka positif." });
    }

    // 4. Validasi Logika Tanggal
    if (tanggalSelesai && new Date(tanggalSelesai) < new Date(tanggalMulai)) {
      return res.status(400).json({ message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
    }

    // 5. Validasi Enum Tipe
    const validTipe = ["Bulanan", "Harian", "Per-jam"];
    if (!validTipe.includes(tipeGaji)) {
      return res.status(400).json({ message: "Tipe gaji tidak valid." });
    }

    const newKontrak = new KontrakKompensasi({
      tenantID,
      penggunaID,
      tipeGaji,
      tarifGaji,
      tanggalMulai,
      tanggalSelesai,
      status: status || "Aktif",
    });

    await newKontrak.save();

    // 6. Cache Invalidation
    await redis.del(keyKontrakList(tenantID));

    res.status(201).json(newKontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllKontrak = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan dalam query params." });
    }

    // 1. Cek Redis Cache
    const cacheKey = keyKontrakList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const kontrak = await KontrakKompensasi.find({ tenantID })
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email role")
      .sort({ createdAt: -1 });

    // 3. Simpan ke Redis (Expire 60 detik)
    await redis.setEx(cacheKey, 60, JSON.stringify(kontrak));

    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getKontrakById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Cek Cache Detail
    const cacheKey = keyKontrakDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const kontrak = await KontrakKompensasi.findById(id)
      .populate("tenantID", "namaToko")
      .populate("penggunaID", "nama email");

    if (!kontrak)
      return res.status(404).json({ message: "Kontrak tidak ditemukan" });

    // 3. Simpan ke Redis
    await redis.setEx(cacheKey, 60, JSON.stringify(kontrak));

    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateKontrak = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["tipeGaji", "tarifGaji", "tanggalMulai", "tanggalSelesai", "status"];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // Validasi Logika jika ada tanggal
    if (updates.tanggalMulai && updates.tanggalSelesai) {
        if (new Date(updates.tanggalSelesai) < new Date(updates.tanggalMulai)) {
            return res.status(400).json({ message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
        }
    }

    // 2. Update DB
    const kontrak = await KontrakKompensasi.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!kontrak)
      return res.status(404).json({ message: "Kontrak tidak ditemukan" });

    // 3. Cache Invalidation
    await redis.del(keyKontrakDetail(id));
    await redis.del(keyKontrakList(kontrak.tenantID));

    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteKontrak = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const kontrak = await KontrakKompensasi.findById(id);
    if (!kontrak)
      return res.status(404).json({ message: "Kontrak tidak ditemukan" });

    // 1. Hapus dari DB
    await KontrakKompensasi.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyKontrakDetail(id));
    await redis.del(keyKontrakList(kontrak.tenantID));

    res.json({ message: "Kontrak berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};