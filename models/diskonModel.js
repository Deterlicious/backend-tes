const mongoose = require("mongoose");

const DiskonSchema = new mongoose.Schema(
  {
    tenantID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    namaDiskon: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    cakupan: {
      type: String,
      enum: ["Global", "Item"],
      required: true,
      index: true,
    },
    tipe: {
      type: String,
      enum: ["persen", "nominal"],
      required: true,
      index: true,
    },
    nilai: {
      type: Number,
      required: true,
      min: [0, "Nilai diskon tidak boleh negatif"],
      validate: {
        validator: function (v) {
          if (this.tipe === "persen" && v > 100) return false;
          return true;
        },
        message: "Diskon bertipe persen tidak boleh melebihi 100",
      },
    },
    bisaDigabung: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ["Aktif", "Non-Aktif"],
      default: "Aktif",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

DiskonSchema.index({ tenantID: 1, namaDiskon: 1 }, { unique: true });

module.exports =
  mongoose.models.Diskon || mongoose.model("Diskon", DiskonSchema);