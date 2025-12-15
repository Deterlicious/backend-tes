const mongoose = require("mongoose");

const PembayaranSchema = new mongoose.Schema(
  {
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: true,
      index: true,
      unique: true,
    },
    metodeBayar: {
      type: String,
      enum: ["tunai", "qris_xendit", "kartu_debit"],
      required: true,
      index: true,
    },
    jumlahBayar: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "EXPIRED", "FAILED"],
      default: "PENDING",
      required: true,
      index: true,
    },
    gatewayPaymentID: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    qrString: {
      type: String,
      default: null,
      trim: true,
    },
    paymentTimestamp: {
      type: Date,
      default: null,
      index: true,
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    kembalian: {
      type: Number,
      default: 0,
      min: 0,
    },
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PembayaranSchema.pre("validate", function (next) {
  if (this.status === "PAID" && !this.paymentTimestamp) {
    this.invalidate(
      "paymentTimestamp",
      "Timestamp wajib diisi jika status PAID"
    );
  }

  if (this.metodeBayar === "tunai" && this.jumlahBayar < this.kembalian) {
    this.invalidate(
      "kembalian",
      "Kembalian tidak boleh lebih besar dari jumlah bayar"
    );
  }
  next();
});

module.exports = mongoose.model("Pembayaran", PembayaranSchema);