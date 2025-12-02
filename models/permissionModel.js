const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
    trim: true,
  },
  grup: {
    type: String,
    required: true,
    trim: true,
    index: true, // Untuk filtering berdasarkan grup
  },
});

// == Compound Index & Unique Constraint ==
// 1. Mencegah duplikasi: Tidak boleh ada nama permission yang sama dalam satu grup.
// 2. Mempercepat sorting: .sort({ grup: 1, nama: 1 })
permissionSchema.index({ grup: 1, nama: 1 }, { unique: true });

module.exports = mongoose.model("Permission", permissionSchema);