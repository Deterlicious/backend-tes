const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const produkRoutes = require('./routes/produkRoutes');
const kategoriRoutes = require('./routes/kategoriRoutes');
const bahanBakuRoutes = require('./routes/bahanbakuRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/db_produk', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Terhubung ke MongoDB'))
.catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

// Routes
app.use('/api/produk', produkRoutes);
app.use('/api/kategori', kategoriRoutes);
app.use('/api/bahanbaku', bahanBakuRoutes);

// Server
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));
