const mongoose = require("mongoose");

const ItemPembelianStokSchema = new mongoose.Schema(
  {
    bahanBakuID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BahanBaku",
      required: true,
    },
    jumlah: {
      type: Number,
      required: true,
      min: [1, "Jumlah minimal 1"],
    },
    hargaBeli: {
      type: Number,
      required: true,
      min: [0, "Harga beli tidak boleh negatif"],
    },
    subtotal: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

ItemPembelianStokSchema.pre("validate", function (next) {
  this.subtotal = this.jumlah * this.hargaBeli;
  next();
});

const PembelianStokSchema = new mongoose.Schema(
  {
    tanggal: {
      type: Date,
      required: true,
      default: Date.now,
    },
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: true,
      index: true,
    },
    totalBiaya: {
      type: Number,
      default: 0,
    },
    supplier: {
      type: String,
      required: true,
      trim: true,
    },
    keterangan: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [ItemPembelianStokSchema],
      required: true,
      validate: [(val) => val.length > 0, "Minimal harus ada 1 item"],
    },
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    locationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    nomorFaktur: {
      type: String,
      default: null,
      trim: true,
    },
    dicatatOleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PembelianStokSchema.pre("validate", function (next) {
  if (this.items && this.items.length > 0) {
    this.totalBiaya = this.items.reduce((acc, item) => {
      const sub = Number(item.subtotal) || item.jumlah * item.hargaBeli;
      return acc + sub;
    }, 0);
  } else {
    this.totalBiaya = 0;
  }
  next();
});

PembelianStokSchema.index(
  { tenantID: 1, nomorFaktur: 1 },
  { unique: true, sparse: true }
);

PembelianStokSchema.index({ tanggal: -1 });

module.exports = mongoose.model("PembelianStok", PembelianStokSchema);