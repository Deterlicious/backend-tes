const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const penggunaSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
    trim: true,
  },
  pin: {
    type: String,
    required: true,
    // Note: 'unique' pada PIN dihilangkan karena PIN '123456' bisa dipakai
    // oleh user berbeda di tenant berbeda. Kombinasi unik harusnya (tenantID + pin)
    // Tapi karena PIN rahasia, validasi unik manual di service lebih aman daripada index DB.
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
  posisiID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Posisi",
    default: null,
    index: true,
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
  tokenVersion: {
    type: Number,
    required: true,
    default: 0,
  },
});

// Compound Index: Optimasi login screen (Tampilkan karyawan aktif di tenant X)
penggunaSchema.index({ tenantID: 1, status: 1 });

// Pre-save hook untuk Hashing PIN
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

// Method Compare PIN
penggunaSchema.methods.comparePin = async function (candidatePin) {
  return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model("Pengguna", penggunaSchema);