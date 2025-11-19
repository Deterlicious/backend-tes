const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const penggunaSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
  },
  pin: {
    type: String,
    unique: true,
    required: true,
  },
  roleID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
  },
  status: {
    type: String,
    enum: ["aktif", "non-aktif"],
    default: "aktif",
  },
  nomorHp: {
    type: String,
    default: null,
  },
  posisiID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Posisi",
    default: null,
  },
  tenantID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  fotoKaryawan: {
    type: String,
    default: null,
  },
  tokenVersion: {
    type: Number,
    required: true,
    default: 0,
  },
});

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

penggunaSchema.methods.comparePin = async function (candidatePin) {
  return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model("Pengguna", penggunaSchema);