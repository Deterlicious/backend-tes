const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Subschema untuk device
const deviceSchema = new mongoose.Schema({
  deviceID: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["primary", "secondary"],
    required: true,
  },
}, { _id: false });

// Subschema untuk deviceHistory
const deviceHistorySchema = new mongoose.Schema({
  deviceID: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["primary", "secondary"],
    required: true,
  },
  action: {
    type: String,
    enum: ["added", "removed", "promoted", "demoted"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

// Schema utama
const profileSchema = new mongoose.Schema({
  username: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  nomorHP: {
    type: String,
    required: true,
  },
  device: [deviceSchema],
  maxPrimaryDevice: {
    type: Number,
    min: 1,
    max: 3,
    default: 1,
  },
  maxDevice: {
    type: Number,
    min: 1,
    max: 6,
    default: 1,
  },
  deviceHistory: [deviceHistorySchema],
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: false, // opsional, bisa diset kalau sudah punya tenant
  },
  role: {
    type: String,
    enum: ["owner", "admin", "kasir"],
    default: "kasir",
  },
});

// 🔒 Hash password sebelum disimpan
profileSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 🔍 Method untuk verifikasi password
profileSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Profile", profileSchema, "profile");
