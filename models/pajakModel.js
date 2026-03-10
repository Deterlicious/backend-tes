const mongoose = require("mongoose");

const PajakSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    namaPajak: {
      type: String,
      required: [true, "Nama pajak wajib diisi."],
      trim: true,
    },
    tarifPajak: {
      type: Number,
      required: [true, "Tarif pajak wajib diisi."],
      min: 0,
    },

    // akunPajakID: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "AkunKas",
    //   required: [true, "Akun pajak wajib diisi."],
    // },

    akunPajakID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
    },

    tipePajak: {
      type: String,
      enum: ["Per Produk", "Per Transaksi"],
      default: "Per Produk",
    },

    modelPerhitungan: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },

    statusPajak: {
      type: Boolean,
      default: true,
    },

    prioritas: {
      type: Number,
      enum: [1, 2],
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PajakSchema.index({ tenantID: 1, namaPajak: 1 }, { unique: true });

module.exports = mongoose.models.Pajak || mongoose.model("Pajak", PajakSchema);