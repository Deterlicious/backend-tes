const mongoose = require("mongoose");

const ItemPenjualanSchema = new mongoose.Schema(
  {
    sesiBookingID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SesiBooking",
      default: null,
      index: true,
    },
    produkID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produk",
      required: [true, "ID Produk wajib diisi."],
      index: true,
    },
    namaProduk: {
      type: String,
      required: [true, "Nama Produk wajib diisi."],
      trim: true,
    },
    jumlah: {
      type: Number,
      required: [true, "Jumlah wajib diisi."],
      min: [1, "Jumlah harus minimal 1."],
    },
    hargaJual: {
      type: Number,
      required: [true, "Harga Jual wajib diisi."],
      min: [0, "Harga Jual tidak boleh negatif."],
    },
    subTotal: {
      type: Number,
      default: 0,
    },
    diskonItemIDs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Diskon",
        index: true,
      },
    ],
    jumlahDiskon: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Jumlah Diskon tidak boleh negatif."],
    },
    total: {
      type: Number,
      default: 0,
    },
    rincianPajak: {
      type: Array,
      default: [],
    },
    jumlahPajak: {
      type: Number,
      default: 0,
    },
    totalharga: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  },
);

const PenjualanSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true,
    },
    noReferensi: {
      type: String,
      required: [true, "No Referensi wajib diisi."],
      trim: true,
    },
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: [true, "Pengguna wajib terisi."],
      index: true,
    },
    pelangganID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pelanggan",
      required: [true, "Pelanggan wajib diisi."],
      index: true,
    },
    jenisTransaksi: {
      type: String,
      enum: {
        values: ["POS", "INVOICE"],
        message: "{VALUE} bukan jenis transaksi valid.",
      },
      required: [true, "Jenis Transaksi wajib diisi."],
    },
    jenisPenjualan: {
      type: String,
      enum: {
        values: ["dine-in", "takeaway", "booking"],
        message: "{VALUE} bukan jenis penjualan valid.",
      },
      required: [true, "Jenis Penjualan wajib diisi."],
    },
    tanggalTransaksi: {
      type: Date,
      required: [true, "Tanggal Transaksi wajib diisi."],
      index: true,
    },
    jatuhTempo: {
      type: Date,
      default: null,
    },
    statusPenjualan: {
      type: String,
      enum: ["DRAFT", "FINAL", "VOID"],
      default: "DRAFT",
      index: true,
    },
    statusBayar: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
      index: true,
    },
    itemPenjualan: {
      type: [ItemPenjualanSchema],
      required: [true, "Item Penjualan wajib diisi."],
    },
    totalHargaProduk: {
      type: Number,
      default: 0,
    },
    diskonGlobalIDs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Diskon",
        index: true,
      },
    ],
    jumlahDiskonTransaksi: {
      type: Number,
      default: 0,
    },
    pajakTransaksiIDs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pajak",
        index: true,
      },
    ],
    jumlahPajakTransaksi: {
      type: Number,
      default: 0,
    },
    totalTagihan: {
      type: Number,
      default: 0,
    },
    totalDibayar: {
      type: Number,
      default: 0,
    },
    sisaTagihan: {
      type: Number,
      default: 0,
    },
    keterangan: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PenjualanSchema.index({ tenantID: 1, noReferensi: 1 }, { unique: true });
PenjualanSchema.index({ tenantID: 1, penggunaID: 1, createdAt: -1 });

PenjualanSchema.pre("validate", function (next) {
  let grandTotalItem = 0;

  if (this.itemPenjualan && this.itemPenjualan.length > 0) {
    this.itemPenjualan.forEach((item) => {
      if (item.subTotal < 0) item.subTotal = 0;
      if (item.total < 0) item.total = 0;
      if (item.totalharga < 0) item.totalharga = 0;

      grandTotalItem += item.totalharga || 0;
    });
  }

  this.totalHargaProduk = grandTotalItem;

  const diskonGbl = Number(this.jumlahDiskonTransaksi) || 0;
  const pajakTransaksi = Number(this.jumlahPajakTransaksi) || 0;

  this.totalTagihan = grandTotalItem - diskonGbl + pajakTransaksi;

  if (this.totalTagihan < 0) {
    this.totalTagihan = 0;
  }

  const dibayar = Number(this.totalDibayar) || 0;
  this.sisaTagihan = this.totalTagihan - dibayar;

  if (this.sisaTagihan < 0) {
    this.sisaTagihan = 0;
  }

  if (this.totalTagihan === 0 || this.sisaTagihan === 0) {
    this.statusBayar = "PAID";
  } else if (dibayar > 0 && this.sisaTagihan > 0) {
    this.statusBayar = "PARTIAL";
  } else {
    this.statusBayar = "UNPAID";
  }

  next();
});

module.exports =
  mongoose.models.Penjualan || mongoose.model("Penjualan", PenjualanSchema);
