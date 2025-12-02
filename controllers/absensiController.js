const Absensi = require("../models/absensiModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyAbsensiList = (tenantID) => `absensi:tenant:${tenantID}`;
const keyAbsensiDetail = (id) => `absensi:detail:${id}`;

exports.createAbsensi = async (req, res) => {
  try {
    const {
      tanggal,
      waktuMasuk,
      fotoMasuk,
      waktuPulang,
      fotoPulang,
      keterangan,
      tenantID,
      penggunaID,
    } = req.body;

    // 1. Validasi Input Wajib
    if (!tanggal || !waktuMasuk || !fotoMasuk || !waktuPulang || !fotoPulang || !tenantID || !penggunaID) {
      return res.status(400).json({ message: "Semua field wajib diisi (kecuali keterangan)." });
    }

    // 2. Validasi ObjectId
    if (!isValidObjectId(tenantID) || !isValidObjectId(penggunaID)) {
      return res.status(400).json({ message: "Format ID Tenant atau Pengguna tidak valid." });
    }

    // 3. Validasi Logika Waktu
    if (new Date(waktuPulang) <= new Date(waktuMasuk)) {
      return res.status(400).json({ message: "Waktu pulang harus setelah waktu masuk." });
    }

    const newAbsensi = new Absensi({
      tanggal,
      waktuMasuk,
      fotoMasuk,
      waktuPulang,
      fotoPulang,
      keterangan,
      tenantID,
      penggunaID,
    });

    await newAbsensi.save();

    // 4. Cache Invalidation
    await redis.del(keyAbsensiList(tenantID));

    res.status(201).json({ message: "Absensi berhasil dibuat", data: newAbsensi });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllAbsensi = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan dalam query params." });
    }

    // 1. Cek Redis Cache
    const cacheKey = keyAbsensiList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const absensi = await Absensi.find({ tenantID })
      .populate("tenantID", "namaToko status")
      .populate("penggunaID", "nama role")
      .sort({ tanggal: -1 }); // Urutkan tanggal terbaru

    // 3. Simpan ke Redis (Expire 60 detik)
    await redis.setEx(cacheKey, 60, JSON.stringify(absensi));

    res.json(absensi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAbsensiById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Cek Cache Detail
    const cacheKey = keyAbsensiDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const absensi = await Absensi.findById(id)
      .populate("tenantID")
      .populate("penggunaID");

    if (!absensi) return res.status(404).json({ message: "Data absensi tidak ditemukan" });

    // 3. Simpan ke Redis
    await redis.setEx(cacheKey, 60, JSON.stringify(absensi));

    res.json(absensi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAbsensi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["waktuMasuk", "waktuPulang", "fotoMasuk", "fotoPulang", "keterangan", "tanggal"];
    const updates = {};
    
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // 2. Hitung Ulang Durasi Kerja (jika waktu berubah)
    // Karena findByIdAndUpdate tidak trigger pre-save hook secara default
    if (updates.waktuMasuk || updates.waktuPulang) {
      const currentData = await Absensi.findById(id);
      if(!currentData) return res.status(404).json({ message: "Data absensi tidak ditemukan" });

      const masuk = updates.waktuMasuk ? new Date(updates.waktuMasuk) : new Date(currentData.waktuMasuk);
      const pulang = updates.waktuPulang ? new Date(updates.waktuPulang) : new Date(currentData.waktuPulang);

      if (pulang <= masuk) {
        return res.status(400).json({ message: "Waktu pulang harus setelah waktu masuk." });
      }

      const durasiMs = pulang - masuk;
      updates.durasiKerja = parseFloat((durasiMs / (1000 * 60 * 60)).toFixed(2));
    }

    // 3. Update DB
    const absensi = await Absensi.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!absensi) return res.status(404).json({ message: "Data absensi tidak ditemukan" });

    // 4. Cache Invalidation
    await redis.del(keyAbsensiDetail(id));
    await redis.del(keyAbsensiList(absensi.tenantID));

    res.json(absensi);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAbsensi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const absensi = await Absensi.findById(id);
    if (!absensi) return res.status(404).json({ message: "Data absensi tidak ditemukan" });

    // 1. Hapus DB
    await Absensi.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyAbsensiDetail(id));
    await redis.del(keyAbsensiList(absensi.tenantID));

    res.json({ message: "Data absensi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};