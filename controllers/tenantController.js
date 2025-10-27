const Tenant = require("../models/tenantModel");

// ✅ CREATE Tenant
exports.createTenant = async (req, res) => {
  try {
    const { namaToko, status, alamat } = req.body;
    if (!namaToko) {
      return res.status(400).json({ message: "nama Toko wajib diisi" });
    }

    const newTenant = new Tenant({ namaToko, status, alamat });
    await newTenant.save();
    res.status(201).json(newTenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 READ Semua Tenant
exports.getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 READ Tenant by ID
exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant tidak ditemukan" });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ UPDATE Tenant
exports.updateTenant = async (req, res) => {
  try {
    const { namaToko, status, alamat } = req.body;
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { namaToko, status, alamat },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ message: "Tenant tidak ditemukan" });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑️ DELETE Tenant
exports.deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant tidak ditemukan" });
    res.json({ message: "Tenant berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
