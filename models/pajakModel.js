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
      type: Number, // Decimal di gambar
      required: [true, "Tarif pajak wajib diisi."],
      min: 0,
    },
    akunPajakID: {
      // FK akun_pajak di gambar
      type: mongoose.Schema.Types.ObjectId,
      ref: "AkunKas",
      required: [true, "Akun pajak wajib diisi."],
    },
    tipePajak: {
      type: String,
      enum: ["Per Produk", "Per Transaksi"],
      default: "Per Produk",
    },
    modelPerhitungan: {
      type: Number,
      enum: [1, 2, 3], // 1=Inclusive, 2=Exclusive, 3=Compound
      required: true,
    },
    statusPajak: {
      type: Boolean,
      default: true, // ON/OFF
    },
    prioritas: {
      type: Number,
      enum: [1, 2], // 1=Service Charge duluan, 2=PBJT dari total+service
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);

// Index unik agar tidak ada nama pajak ganda dalam satu tenant
PajakSchema.index({ tenantID: 1, namaPajak: 1 }, { unique: true });

module.exports = mongoose.model("Pajak", PajakSchema);
