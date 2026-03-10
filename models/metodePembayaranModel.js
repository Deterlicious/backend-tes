const mongoose = require("mongoose");

const MetodePembayaranSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    namaPembayaran: {
      type: String,
      required: true,
      trim: true,
    },
    kategori: {
      type: String,
      enum: ["non-tunai", "tunai"],
      required: true,
    },
    isAutomated: {
      type: Boolean,
      default: false,
    },
    xenditChannelCode: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

MetodePembayaranSchema.pre("validate", function (next) {
  if (this.isAutomated === true) {
    if (this.kategori !== "non-tunai") {
      this.invalidate(
        "kategori",
        "Metode Xendit (Automated) harus berkategori non-tunai."
      );
    }

    if (!this.xenditChannelCode || this.xenditChannelCode.trim() === "") {
      this.invalidate(
        "xenditChannelCode",
        "xenditChannelCode wajib diisi jika isAutomated bernilai true."
      );
    }
  } else {
    this.xenditChannelCode = null;
  }

  next();
});

module.exports =
  mongoose.models.MetodePembayaran ||
  mongoose.model("MetodePembayaran", MetodePembayaranSchema);