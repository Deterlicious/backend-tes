require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Definisi Model Inline (Saya update agar sesuai dengan Model Asli)
const AkunSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, hash: true },
  role: { type: String, required: true },
  roleID: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  tenantID: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
  maxPrimaryDevice: { type: Number, default: 3 },
  maxDevice: { type: Number, default: 5 },
  device: { type: Array, default: [] },
  deviceHistory: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Cek apakah model sudah ada compile sebelumnya untuk menghindari OverwriteModelError
const Akun = mongoose.models.Akun || mongoose.model("Akun", AkunSchema);

const seedDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk"
    );
    console.log("🔌 Terhubung ke MongoDB");

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const akunList = [
      {
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "admin",
        roleID: null,
        tenantID: null,
        maxPrimaryDevice: 3,
        maxDevice: 5,
        device: [],
        deviceHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await Akun.insertMany(akunList);
    console.log("✅ Berhasil seeding Akun dengan password ter-hash!");

    process.exit();
  } catch (err) {
    console.error("❌ Gagal seeding:", err);
    process.exit(1);
  }
};


seedDB();

