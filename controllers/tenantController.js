const Tenant = require("../models/tenantModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyTenantList = "tenant:all"; // Cache untuk semua tenant (Super Admin View)
const keyTenantDetail = (id) => `tenant:detail:${id}`;

// Helper: Validasi Email
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

exports.createTenant = async (req, res) => {
  try {
    const { 
      namaToko, alamat, kota, kodePos, nomorTelepon, 
      emailBisnis, logoUrl, footerStruk, idNPWP, 
      persenPajak, tipePajak 
    } = req.body;

    // 1. Validasi Input Wajib
    if (!namaToko) {
      return res.status(400).json({ message: "Nama Toko wajib diisi" });
    }

    // 2. Validasi Format
    if (emailBisnis && !isValidEmail(emailBisnis)) {
      return res.status(400).json({ message: "Format email bisnis tidak valid" });
    }

    if (persenPajak && (persenPajak < 0 || persenPajak > 100)) {
        return res.status(400).json({ message: "Persen pajak harus antara 0 - 100" });
    }

    const newTenant = new Tenant({
      namaToko,
      alamat,
      kota,
      kodePos,
      nomorTelepon,
      emailBisnis,
      logoUrl,
      footerStruk,
      idNPWP,
      persenPajak: persenPajak || 0,
      tipePajak,
      isSetupComplete: false
    });

    await newTenant.save();

    // 3. Cache Invalidation
    // Karena ada tenant baru, list tenant di cache harus dihapus
    await redis.del(keyTenantList);

    res.status(201).json(newTenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllTenants = async (req, res) => {
  try {
    // 1. Cek Cache
    const cachedData = await redis.get(keyTenantList);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const tenants = await Tenant.find().sort({ createdAt: -1 });

    // 3. Simpan Cache (Expire 5 menit, karena tenant jarang bertambah)
    await redis.setEx(keyTenantList, 300, JSON.stringify(tenants));

    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Tenant tidak valid" });
    }

    // 1. Cek Cache Detail
    const cacheKey = keyTenantDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const tenant = await Tenant.findById(id);
    if (!tenant)
      return res.status(404).json({ message: "Tenant tidak ditemukan" });

    // 3. Simpan Cache (Expire 10 menit, profil toko jarang berubah)
    await redis.setEx(cacheKey, 600, JSON.stringify(tenant));

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Tenant tidak valid" });
    }

    // 1. Validasi Field (Whitelisting)
    // Cegah user mengupdate field yang tidak seharusnya (misal isSetupComplete jika logicnya khusus)
    const allowedUpdates = [
      "namaToko", "status", "alamat", "kota", "kodePos", 
      "nomorTelepon", "emailBisnis", "logoUrl", "footerStruk", 
      "idNPWP", "persenPajak", "tipePajak", "isSetupComplete"
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
        if(allowedUpdates.includes(key)) updates[key] = req.body[key];
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // Validasi Spesifik
    if (updates.emailBisnis && !isValidEmail(updates.emailBisnis)) {
        return res.status(400).json({ message: "Format email bisnis tidak valid" });
    }
    if (updates.persenPajak !== undefined && (updates.persenPajak < 0 || updates.persenPajak > 100)) {
        return res.status(400).json({ message: "Persen pajak harus antara 0 - 100" });
    }

    // 2. Update DB
    const tenant = await Tenant.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!tenant)
      return res.status(404).json({ message: "Tenant tidak ditemukan" });

    // 3. Cache Invalidation
    await redis.del(keyTenantDetail(id));
    await redis.del(keyTenantList);

    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID Tenant tidak valid" });
    }

    const tenant = await Tenant.findByIdAndDelete(id);
    if (!tenant)
      return res.status(404).json({ message: "Tenant tidak ditemukan" });

    // 1. Cache Invalidation
    await redis.del(keyTenantDetail(id));
    await redis.del(keyTenantList);

    res.json({ message: "Tenant berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};