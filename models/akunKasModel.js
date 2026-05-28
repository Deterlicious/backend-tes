const mongoose = require("mongoose");

const AkunKasSchema = new mongoose.Schema(
  {
    namaAkun: {
      type: String,
      required: true,
      trim: true,
    },
    saldo: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Saldo tidak boleh negatif"],
    },
    tipeAkun: {
      type: String,
      enum: ["Kas Fisik", "Rekening Bank"],
      required: true,
    },
    status: {
      type: String,
      enum: ["aktif", "non-aktif"],
      default: "aktif",
    },
    nomorAkun: {
      type: String,
      required: true,
      trim: true,
    },
    keterangan: {
      type: String,
      default: null,
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
  },
);

AkunKasSchema.index(
  {
    tenantID: 1,
    nomorAkun: 1,
  },
  {
    unique: true,
  },
);
AkunKasSchema.index({
  namaAkun: 1,
});

module.exports = mongoose.model("AkunKas", AkunKasSchema);
