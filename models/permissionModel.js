const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
  },
  grup: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Permission", permissionSchema);