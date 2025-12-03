const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Device Schema
const deviceSchema = new mongoose.Schema(
  {
    deviceID: {
      type: String,
      required: true,
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
    lastUsed: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

// Device History Schema
const deviceHistorySchema = new mongoose.Schema(
  {
    deviceID: { type: String, required: true },
    type: { type: String, required: true },
    action: {
      type: String,
      enum: ["added", "removed", "promoted", "demoted"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Akun Schema
const akunSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["client", "admin"],
      default: "client",
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
      default: null,
      required: false,
    },
  },
  { timestamps: true }
);

// COMPOUND INDEX: 
// Menggantikan index single 'tenantID' dan 'role'
// Mempercepat query filtering di dashboard admin
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