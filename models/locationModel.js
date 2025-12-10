const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
    trim: true,
  }, // e.g., "Gudang Pusat", "Cabang Jaksel"

  tipe: {
    type: String,
    enum: ["GUDANG", "OUTLET"],
    required: true,
  },

  alamat: {
    type: String,
    required: true,
  },

  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },

});

module.exports = mongoose.model("Location", LocationSchema);
