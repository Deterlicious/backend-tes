const mongoose = require("mongoose");

const PaketMembershipSchema = new mongoose.Schema(
  {
    namaPaket: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    harga: {
      type: Number,
      required: true,
      min: [0, "Harga tidak boleh negatif"],
      index: true,
    },
    durasiHari: {
      type: Number,
      required: true,
      min: [1, "Durasi minimal 1 hari"],
    },
    deskripsi: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Aktif", "Non-Aktif"],
      default: "Aktif",
      index: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PaketMembershipSchema.index({
  tenantID: 1,
  namaPaket: 1
}, {
  unique: true
});

module.exports = mongoose.model("PaketMembership", PaketMembershipSchema);