const mongoose = require("mongoose");

const sesiBookingSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    dataPengguna: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
    dataPelanggan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pelanggan",
      required: true,
      index: true,
    },
    dataAset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aset",
      required: true,
      index: true,
    },
    dataPenjualan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: true,
      index: true,
    },
    waktuMulai: {
      type: Date,
      required: true,
    },
    waktuSelesai: {
      type: Date,
      default: null,
    },
    durasiMenit: {
      type: Number,
      default: null,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Aktif", "Selesai", "Batal"],
      default: "Aktif",
      index: true,
    },
    totalBiaya: {
      type: Number,
      default: null,
      min: 0,
    },
    dataTarif: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tarif",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

sesiBookingSchema.index({ dataAset: 1, status: 1, waktuMulai: 1 });
sesiBookingSchema.index({ tenantID: 1, waktuMulai: -1 });

sesiBookingSchema.pre("save", function (next) {
  if (this.waktuMulai && this.waktuSelesai) {
    if (this.waktuSelesai < this.waktuMulai) {
      return next(
        new Error("Waktu selesai tidak boleh lebih awal dari waktu mulai.")
      );
    }

    const diffMs = new Date(this.waktuSelesai) - new Date(this.waktuMulai);
    this.durasiMenit = Math.ceil(diffMs / (1000 * 60));
  }

  next();
});

module.exports = mongoose.model("SesiBooking", sesiBookingSchema);