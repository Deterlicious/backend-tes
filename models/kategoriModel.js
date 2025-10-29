const mongoose = require("mongoose");

const KategoriSchema = new mongoose.Schema(
  {
    kategoriID: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    namaKategori: {
      type: String,
      required: true,
      trim: true,
    },
    kodeKategori: {
      type: String,
      required: true,
      trim: true,
    },
    keterangan: {
      type: String,
      default: null,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Kategori = mongoose.model("Kategori", KategoriSchema);
module.exports = Kategori;