const mongoose = require("mongoose");

const JurnalTransferSchema = new mongoose.Schema(
  {
    tanggal: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    kasSumberID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: true,
      index: true,
    },
    kasTujuanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: true,
      index: true,
    },
    jumlah: {
      type: Number,
      required: true,
      min: [1, "Jumlah transfer minimal 1"],
    },
    keterangan: {
      type: String,
      required: true,
      trim: true,
    },
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
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

JurnalTransferSchema.pre("validate", function (next) {
  if (
    this.kasSumberID &&
    this.kasTujuanID &&
    this.kasSumberID.equals(this.kasTujuanID)
  ) {
    this.invalidate(
      "kasTujuanID",
      "Kas Sumber dan Kas Tujuan tidak boleh sama."
    );
  }
  next();
});

module.exports = mongoose.model("JurnalTransfer", JurnalTransferSchema);