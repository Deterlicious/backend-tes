require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

// MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/db_produk")
  .then(() => console.log("✅ Terhubung ke MongoDB"))
  .catch((err) => console.error("❌ Gagal koneksi ke MongoDB:", err));

// Import routes
const produkRoutes = require("./routes/produkRoutes");
const kategoriRoutes = require("./routes/kategoriRoutes");
const bahanBakuRoutes = require("./routes/bahanbakuRoutes");
const tenantRoute = require("./routes/tenantRoute");
const akunRoute = require("./routes/akunRoute");
const posisiRoute = require("./routes/posisiRoute");
const penggunaRoute = require("./routes/penggunaRoute");
const roleRoutes = require("./routes/roleRoute");
const permissionRoutes = require("./routes/permissionRoute");
const rolePermissionRoutes = require("./routes/rolePermissionRoute");
const absensiRoute = require("./routes/absensiRoute");
const izinCutiRoute = require("./routes/izinCutiRoute");
const kontrakKompensasiRoute = require("./routes/kontrakKompensasiRoute");
const akunKasRoute = require("./routes/akunKasRoute");
const pembelianStokRoute = require("./routes/pembelianStokRoute");
const penjualanRoute = require("./routes/penjualanRoute");
const pelangganRoute = require('./routes/pelangganRoute');
const membershipRoute = require('./routes/membershipRoute');
const paketMembershipRoute = require('./routes/paketMembershipRoute');
const pembayaranRoute = require('./routes/pembayaranRoute');
const diskonRoute = require('./routes/diskonRoute');

// Routes
app.use("/api/produk", produkRoutes);
app.use("/api/kategori", kategoriRoutes);
app.use("/api/bahanbaku", bahanBakuRoutes);
app.use("/api/tenant", tenantRoute);
app.use("/api/akun", akunRoute);
app.use("/api/posisi", posisiRoute);
app.use("/api/pengguna", penggunaRoute);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/rolepermissions", rolePermissionRoutes);
app.use("/api/absensi", absensiRoute);
app.use("/api/izincuti", izinCutiRoute);
app.use("/api/kontrakkompensasi", kontrakKompensasiRoute);
app.use("/api/akunkas", akunKasRoute);
app.use("/api/pembelianstok", pembelianStokRoute);
app.use("/api/penjualan", penjualanRoute);
app.use('/api/pelanggan', pelangganRoute);
app.use('/api/membership', membershipRoute);
app.use('/api/paketmembership', paketMembershipRoute);
app.use('/api/pembayaran', pembayaranRoute);
app.use('/api/diskon', diskonRoute);

// Server
app.listen(4000, "127.0.0.1", () => {
  console.log("🚀 Server running on http://127.0.0.1:4000");
});