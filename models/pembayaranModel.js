const mongoose = require("mongoose");

const PembayaranSchema = new mongoose.Schema(
  {
    // pembayaranID dihilangkan, menggunakan _id default MongoDB

    // FK: Referensi ke Penjualan
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: [true, "ID Penjualan wajib diisi."],
    },

    metodeBayar: {
      type: String,
      enum: {
        values: ["tunai", "qris_xendit", "kartu_debit"],
        message:
          "{VALUE} bukan metode bayar yang valid. Pilihan: tunai, qris_xendit, kartu_debit.",
      },
      required: [true, "Metode bayar wajib diisi."],
    },

    jumlahBayar: {
      type: Number,
      required: [true, "Jumlah bayar wajib diisi."],
      min: [0, "Jumlah bayar tidak boleh negatif."],
    },

    status: {
      type: String,
      enum: {
        values: ["PAID", "PENDING", "EXPIRED", "FAILED"],
        message:
          "{VALUE} bukan status pembayaran yang valid. Pilihan: PAID, PENDING, EXPIRED, FAILED.",
      },
      default: "PENDING",
      required: [true, "Status wajib diisi."],
    },

    gatewayPaymentID: {
      type: String,
      default: null, // nullable
      trim: true,
    },

    qrString: {
      type: String,
      default: null, // nullable
      trim: true,
    },

    paymentTimestamp: {
      type: Date,
      default: null, // nullable
    },

    // FK: Referensi ke Tenant
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
    },

    kembalian: {
      type: Number,
      default: 0, // nullable, default: 0
      min: [0, "Nilai kembalian tidak boleh negatif."],
    },

    // FK: Referensi ke Akun Kas (tempat dana masuk)
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "Akun Kas tujuan wajib diisi."],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PembayaranSchema.pre("validate", function (next) {
  // Ini adalah tempat terbaik untuk validasi logika bisnis lintas field

  // Jika status PAID, paymentTimestamp wajib diisi
  if (this.status === "PAID" && !this.paymentTimestamp) {
    // Jika gagal, buat error kustom Mongoose
    this.invalidate(
      "paymentTimestamp",
      "Payment Timestamp wajib diisi jika status PAID.",
      this.paymentTimestamp
    );
  }

  // Jika metode bayar tunai, kembalian harus >= 0 (sudah ditangani min:0, tapi bisa diperkuat di sini)
  if (this.metodeBayar === "tunai" && this.jumlahBayar < this.kembalian) {
    this.invalidate(
      "kembalian",
      "Kembalian tidak boleh lebih besar dari jumlah bayar.",
      this.kembalian
    );
  }

  // Panggil next() untuk melanjutkan
  next();
});

const Pembayaran = mongoose.model("Pembayaran", PembayaranSchema);

module.exports = Pembayaran;
