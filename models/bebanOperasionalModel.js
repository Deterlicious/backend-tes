const mongoose = require("mongoose");

const BebanOperasionalSchema = new mongoose.Schema(
  {
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: true,
      index: true,
    },
    kategoriBebanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KategoriBeban",
      required: true,
      index: true,
    },
    tanggal: {
      type: Date,
      required: true,
      index: true,
    },
    jumlah: {
      type: Number,
      required: true,
      min: [1, "Jumlah biaya harus lebih dari 0"],
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

BebanOperasionalSchema.index({
  tenantID: 1,
  tanggal: -1
});

module.exports = mongoose.model("BebanOperasional", BebanOperasionalSchema);