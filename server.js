require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/db_produk')
  .then(() => console.log('✅ Terhubung ke MongoDB'))
  .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

// Import routes
const produkRoutes = require('./routes/produkRoutes');
const kategoriRoutes = require('./routes/kategoriRoutes');
const bahanBakuRoutes = require('./routes/bahanbakuRoutes');
const tenantRoute = require("./routes/tenantRoute");
const akunRoute = require("./routes/akunRoute");
const posisiRoute = require("./routes/posisiRoute");
const penggunaRoute = require("./routes/penggunaRoute");
const absensiRoute = require("./routes/absensiRoute");
const izinCutiRoute = require("./routes/izinCutiRoute");
const akunKasRoute = require("./routes/akunKasRoute");
const pembelianRoute = require("./routes/pembelianRoute");
const penjualanRoute = require("./routes/penjualanRoute");

// Routes
app.use('/api/produk', produkRoutes);
app.use('/api/kategori', kategoriRoutes);
app.use('/api/bahanbaku', bahanBakuRoutes);
app.use("/api/tenant", tenantRoute);
app.use("/api/akun", akunRoute);
app.use("/api/posisi", posisiRoute);
app.use("/api/pengguna", penggunaRoute);
app.use("/api/absensi", absensiRoute);
app.use("/api/izincuti", izinCutiRoute);
app.use("/api/akunkas", akunKasRoute);
app.use("/api/pembelian", pembelianRoute);
app.use("/api/penjualan", penjualanRoute);

// Server
app.listen(4000, "127.0.0.1", () => {
  console.log("🚀 Server running on http://127.0.0.1:4000");
});
