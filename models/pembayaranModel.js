const mongoose = require("mongoose");

const PembayaranSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "Akun Kas wajib diisi"],
      index: true,
    },
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: true,
      index: true,
    },
    metodePembayaranID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MetodePembayaran",
      required: true,
      index: true,
    },
    noReferensi: {
      type: String,
      required: [true, "No Referensi Penjualan wajib diisi"],
      trim: true,
      index: true,
    },
    tanggalBayar: {
      type: Date,
      default: null,
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
    jumlahBayar: {
      type: Number,
      required: true,
      min: [0, "Jumlah bayar tidak boleh negatif"],
    },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "EXPIRED", "FAILED", "VOID"],
      default: "PENDING",
      required: true,
      index: true,
    },
    catatan: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PembayaranSchema.pre("validate", function (next) {
  if (this.status === "PAID" && !this.tanggalBayar) {
    this.invalidate(
      "tanggalBayar",
      "Tanggal bayar wajib diisi jika status PAID",
    );
  }

  next();
});

module.exports = mongoose.model("Pembayaran", PembayaranSchema);
