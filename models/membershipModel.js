const mongoose = require("mongoose");

const MembershipSchema = new mongoose.Schema(
  {
    pelangganID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pelanggan",
      required: true,
      index: true,
    },
    paketMembershipID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaketMembership",
      required: true,
      index: true,
    },
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: true,
      unique: true,
      index: true,
    },
    tanggalMulai: {
      type: Date,
      required: true,
      index: true,
    },
    tanggalKadaluarsa: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Aktif", "Kadaluarsa"],
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

MembershipSchema.index({
  pelangganID: 1,
  status: 1
});
MembershipSchema.index({
  tenantID: 1,
  tanggalKadaluarsa: 1
});

module.exports = mongoose.model("Membership", MembershipSchema);