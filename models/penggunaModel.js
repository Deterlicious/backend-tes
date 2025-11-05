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
    minlength: [6, "PIN minimal 6 karakter"],
  },
  role: {
    type: String,
    enum: ["owner", "admin", "staff"],
    required: true,
  },
  status: {
    type: String,
    enum: ["aktif", "non-aktif"],
    default: "aktif",
  },
  nomorHP: {
    type: String,
    default: null,
  },
  posisiID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Posisi",
    required: false,
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
});

// Hash pin sebelum disimpan
penggunaSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();

  // Cek panjang PIN minimal 6
  if (this.pin.length < 6) {
    return next(new Error("PIN minimal 6 karakter"));
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 🔍 Verifikasi pin
penggunaSchema.methods.comparePin = async function (candidatePin) {
  return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model("Pengguna", penggunaSchema);
