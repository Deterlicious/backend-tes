const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Skema Perangkat (Device) — dipindah dari akunModel
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
      default: Date.now,
    },
  },
  { _id: false },
);

// Skema Riwayat Perangkat (Device History) — dipindah dari akunModel
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
  { _id: false },
);

const penggunaSchema = new mongoose.Schema(
  {
    nama: {
      type: String,
      required: true,
      trim: true,
    },
    pin: {
      type: String,
      required: true,
    },
    roleID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["aktif", "non-aktif"],
      default: "aktif",
      index: true,
    },
    nomorHp: {
      type: String,
      default: null,
      trim: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    fotoKaryawan: {
      type: String,
      default: null,
    },

    // Tipe akses: web = tidak perlu device binding, app = wajib device binding
    aksesType: {
      type: String,
      enum: ["web", "app"],
      default: "app",
    },

    // Device management — hanya relevan untuk aksesType "app"
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

    // tokenVersion untuk pengguna web (revoke sesi)
    // untuk pengguna app, tokenVersion ada di dalam device object
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound Index: Optimasi login screen (Tampilkan karyawan aktif di tenant X)
penggunaSchema.index({ tenantID: 1, status: 1 });
penggunaSchema.index({ tenantID: 1, nama: 1 }, { unique: true });

// Middleware untuk Hashing PIN sebelum disimpan
penggunaSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method untuk membandingkan PIN saat login
penggunaSchema.methods.comparePin = async function (candidatePin) {
  return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model("Pengguna", penggunaSchema);