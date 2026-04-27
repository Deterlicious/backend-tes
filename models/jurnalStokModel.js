const mongoose = require("mongoose");

const JurnalStokSchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      required: true,
      index: true,
    },
    tanggal: {
      type: Date,
      required: true,
      index: true,
    },
    tipeKoreksi: {
      type: String,
      enum: ["Masuk", "Keluar"],
      required: true,
    },
    jumlah: {
      type: Number,
      required: true,
      min: [0, "Jumlah tidak boleh negatif"],
    },
    alasan: {
      type: String,
      enum: ["Stok Opname", "Rusak/Hilang", "Transfer Gudang", "Lainnya"],
      required: true,
    },
    keterangan: {
      type: String,
      default: null,
      trim: true,
    },
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
      index: true,
    },
    locationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
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
  },
);

JurnalStokSchema.index({
  tenantID: 1,
  bahanBakuID: 1,
  tanggal: -1,
});

module.exports = mongoose.model("JurnalStok", JurnalStokSchema);
