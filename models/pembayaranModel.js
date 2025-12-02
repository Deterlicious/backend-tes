const mongoose = require("mongoose");

const PembayaranSchema = new mongoose.Schema(
  {
    // FK: Referensi ke Penjualan
    penjualanID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Penjualan",
      required: [true, "ID Penjualan wajib diisi."],
      index: true, // Optimasi filter/populasi
      unique: true, // Satu pembayaran biasanya terkait dengan satu penjualan (disarankan)
    },

    metodeBayar: {
      type: String,
      enum: {
        values: ["tunai", "qris_xendit", "kartu_debit"],
        message:
          "{VALUE} bukan metode bayar yang valid. Pilihan: tunai, qris_xendit, kartu_debit.",
      },
      required: [true, "Metode bayar wajib diisi."],
      index: true, // Optimasi filter
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
      index: true, // Optimasi filter
    },

    gatewayPaymentID: {
      type: String,
      default: null, // nullable
      trim: true,
      index: true, // Index jika sering dicari berdasarkan ID gateway
    },

    qrString: {
      type: String,
      default: null, // nullable
      trim: true,
    },

    paymentTimestamp: {
      type: Date,
      default: null, // nullable
      index: true, // Optimasi sorting/laporan waktu bayar
    },

    // FK: Referensi ke Tenant
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID wajib diisi."],
      index: true, // Optimasi filter multi-tenant (wajib)
    },

    kembalian: {
      type: Number,
      default: 0,
      min: [0, "Nilai kembalian tidak boleh negatif."],
    },

    // FK: Referensi ke Akun Kas (tempat dana masuk)
    akunKasID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "Akun Kas tujuan wajib diisi."],
      index: true, // Optimasi filter/populasi
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// --- CROSS-FIELD VALIDATION (Dipertahankan dan Disempurnakan) ---
PembayaranSchema.pre("validate", function (next) {
  // 1. Jika status PAID, paymentTimestamp wajib diisi
  if (this.status === "PAID" && !this.paymentTimestamp) {
    this.invalidate(
      "paymentTimestamp",
      "Payment Timestamp wajib diisi jika status PAID.",
      this.paymentTimestamp
    );
  }

  // 2. Jika metode bayar tunai, kembalian tidak boleh lebih besar dari jumlah uang yang dibayarkan
  if (this.metodeBayar === "tunai" && this.jumlahBayar < this.kembalian) {
    this.invalidate(
      "kembalian",
      "Kembalian tidak boleh lebih besar dari jumlah bayar.",
      this.kembalian
    );
  }
  next();
});

const Pembayaran = mongoose.model("Pembayaran", PembayaranSchema);

module.exports = Pembayaran;
