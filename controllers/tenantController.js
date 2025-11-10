const Tenant = require("../models/tenantModel");

exports.createTenant = async (req, res) => {
  try {
    if (!req.body.namaToko) {
      return res.status(400).json({ message: "nama Toko wajib diisi" });
    }
    const newTenant = new Tenant(req.body);
    await newTenant.save();
    res.status(201).json(newTenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant)
      return res.status(404).json({ message: "Tenant tidak ditemukan" });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!tenant)
      return res.status(404).json({ message: "Tenant tidak ditemukan" });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant)
      return res.status(404).json({ message: "Tenant tidak ditemukan" });
    res.json({ message: "Tenant berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};