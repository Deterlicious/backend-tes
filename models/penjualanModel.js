const mongoose = require("mongoose");

const ItemPenjualanSchema = new mongoose.Schema(
  {
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
    sesiBookingID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SesiBooking",
      default: null,
      index: true,
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
    diskonID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Diskon",
      default: null,
      index: true,
    },
    jumlahDiskon: {
      type: Number,
      default: 0,
      min: [0, "Jumlah Diskon tidak boleh negatif."],
    },
    hargaKotor: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const PenjualanSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true,
    },
    nomorFaktur: {
      type: String,
      required: [true, "Nomor Faktur wajib diisi."],
      trim: true,
    },
    dataPelanggan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pelanggan",
      default: null,
      index: true,
    },
    jenisPenjualan: {
      type: String,
      enum: {
        values: ["dine-in", "takeaway", "booking"],
        message: "{VALUE} bukan jenis penjualan valid.",
      },
      required: [true, "Jenis Penjualan wajib diisi."],
    },
    tanggalPenjualan: {
      type: Date,
      default: null,
      index: true,
    },
    itemPenjualan: {
      type: [ItemPenjualanSchema],
      required: [true, "Item Penjualan wajib diisi."],
    },
    statusPembayaran: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
      index: true,
    },
    totalHarga: {
      type: Number,
      default: 0,
    },
    sisaTagihan: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PenjualanSchema.index({ tenantID: 1, nomorFaktur: 1 }, { unique: true });

PenjualanSchema.pre("validate", function (next) {
  let grandTotal = 0;

  if (this.itemPenjualan && this.itemPenjualan.length > 0) {
    this.itemPenjualan.forEach((item) => {
      const hrg = Number(item.hargaJual) || 0;
      const jml = Number(item.jumlah) || 1;
      const dsk = Number(item.jumlahDiskon) || 0;

      item.hargaKotor = hrg * jml;

      item.subtotal = item.hargaKotor - dsk;
      if (item.subtotal < 0) item.subtotal = 0;

      grandTotal += item.subtotal;
    });
  }

  this.totalHarga = grandTotal;

  if (this.isNew) {
    this.sisaTagihan = this.totalHarga;
  }

  next();
});

PenjualanSchema.pre("save", function (next) {
  if (this.isModified("statusPembayaran")) {
    if (
      ["PARTIAL", "PAID"].includes(this.statusPembayaran) &&
      !this.tanggalPenjualan
    ) {
      this.tanggalPenjualan = new Date();
    }
  }
  next();
});

module.exports = mongoose.model("Penjualan", PenjualanSchema);