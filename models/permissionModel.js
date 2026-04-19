const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
    trim: true,
    unique: true, // Nama permission harus unik secara global
  },
  grup: {
    type: String,
    required: true,
    trim: true,
    index: true, // Index untuk filtering/sorting grup
  },
  deskripsi: {
    type: String,
    default: null,
  }
});

// Index Compound untuk sorting cepat
permissionSchema.index({ grup: 1, nama: 1 });

module.exports = mongoose.model("Permission", permissionSchema);