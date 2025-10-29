const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/db_produk')
  .then(() => console.log('✅ Terhubung ke MongoDB'))
  .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

// Import routes
const produkRoutes = require('./routes/produkRoutes');
const kategoriRoutes = require('./routes/kategoriRoutes');
const bahanBakuRoutes = require('./routes/bahanbakuRoutes');
const tenantRoute = require("./routes/tenantRoute");
const profilRoute = require("./routes/profilRoute");

// Routes
app.use('/api/produk', produkRoutes);
app.use('/api/kategori', kategoriRoutes);
app.use('/api/bahanbaku', bahanBakuRoutes);
app.use("/api/tenant", tenantRoute);
app.use("/api/profil", profilRoute);

// Server
app.listen(4000, "127.0.0.1", () => {
  console.log("🚀 Server running on http://127.0.0.1:4000");
});