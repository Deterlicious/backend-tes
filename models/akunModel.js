const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Device Schema
const deviceSchema = new mongoose.Schema({
  deviceID: {
    type: String,
    required: true,
    // Indexing deviceID di dalam subdocument untuk mempercepat pencarian device saat login
    index: true, 
  },
  type: {
    type: String,
    enum: ["primary", "secondary"],
    required: true,
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
}, { _id: false });

// Device History Schema
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

// Akun Schema
const akunSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true, // Auto trim spasi
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    // Indexing email sudah otomatis karena unique: true, tapi kita pastikan
    index: true, 
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["client", "admin"],
    default: "client",
    index: true, // Indexing role jika sering filter berdasarkan role
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
    required: false,
    index: true, // Indexing foreign key
  },
});

// Compound Index: Contoh jika sering mencari user berdasarkan tenant dan role
akunSchema.index({ tenantID: 1, role: 1 });

akunSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

akunSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Akun", akunSchema);