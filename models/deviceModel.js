const mongoose = require("mongoose");
const { DEVICE_STATUS } = require("../config/constants");

const deviceSchema = new mongoose.Schema(
  {
    // Relasi ke Pengguna (Kasir/Staf yang login)
    penggunaID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      required: true,
    },
    // UUID dari Secure Storage Mobile
    installationId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(DEVICE_STATUS),
      default: DEVICE_STATUS.PENDING,
      index: true,
    },
    // Hash HMAC SHA-256 (Tidak di-return secara default saat query)
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    // METADATA (Untuk Audit & Dashboard)
    deviceName: {
      type: String,
      maxlength: 100,
      trim: true,
      default: "Unknown Device",
    },
    platform: {
      type: String,
      maxlength: 50,
      trim: true,
      default: "Unknown",
    },
    lastIpAddress: {
      type: String,
      maxlength: 45, // Support panjang IPv6
      default: null,
    },
    appVersion: {
      type: String,
      maxlength: 20,
      default: null,
    },
    osVersion: {
      type: String,
      maxlength: 50,
      default: null,
    },

    // TIMESTAMPS SPESIFIK
    lastSeenAt: {
      type: Date,
      default: null,
    },
    lastRefreshAt: {
      type: Date,
      default: null,
    },
    pendingExpiresAt: {
      type: Date,
      default: null,
    },

    // AUDIT TRAILS (Siapa yang setujui/cabut)
    // Menggunakan ref 'Akun' atau 'Pengguna' tergantung siapa yang bisa akses dashboard owner
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna", // Asumsi Owner login pakai Akun SaaS untuk approve
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pengguna",
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// INDEXING (Krusial untuk performa & mencegah duplikasi)
// 1 Device hanya boleh punya 1 status aktif per Pengguna (Composite Unique)
deviceSchema.index({ penggunaID: 1, installationId: 1 }, { unique: true });
// Index untuk pencarian cepat oleh Middleware cache
deviceSchema.index({ installationId: 1 });

module.exports = mongoose.model("Device", deviceSchema);
