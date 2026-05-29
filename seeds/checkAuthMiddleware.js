/**
 * ==============================================================
 * TUGAS 23 — VERIFIKASI STRUKTUR req.pengguna dari authPengguna
 * ==============================================================
 * Script ini mensimulasikan PERSIS apa yang dilakukan middleware
 * authPengguna.js terhadap data nyata di database.
 *
 * Yang diverifikasi:
 *   ✅ req.pengguna._id         → ID unik pengguna
 *   ✅ req.pengguna.tenantID    → ID perusahaan (untuk scope data)
 *   ✅ req.pengguna.permissions → Array string nama permission
 *
 * Cara jalankan:
 *   node seeds/checkAuthMiddleware.js
 *
 * PERHATIAN: mainSeed.js harus sudah dijalankan terlebih dahulu!
 * ==============================================================
 */

require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// ── Import semua model yang terlibat dalam populate ────────────
// PENTING: Role dan Permission harus di-import agar mongoose
// bisa melakukan .populate() dari penggunaModel → roleID → permissions
const Pengguna    = require("../models/penggunaModel");
const Role        = require("../models/roleModel");        // perlu untuk populate roleID
const Permission  = require("../models/permissionModel"); // perlu untuk populate permissions

const DB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk";
const PENGGUNA_JWT_SECRET =
  process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";

// ==============================================================
// FUNGSI UTAMA: Simulasi authPengguna middleware
// Ini adalah COPY EXACT dari logika di middleware/authPengguna.js
// ==============================================================
async function simulasiAuthPengguna(namaPengguna) {
  // ── STEP 1: Cari pengguna dari DB ─────────────────────────────
  // Ini simulasi: di middleware asli, ID diambil dari JWT token.
  // Di sini kita ambil langsung dari nama (untuk test).
  const penggunaRaw = await Pengguna.findOne({ nama: namaPengguna })
    .select("_id tokenVersion")
    .lean();

  if (!penggunaRaw) {
    throw new Error(`Pengguna "${namaPengguna}" tidak ditemukan di database.`);
  }

  // ── STEP 2: Buat JWT token (simulasi token yang valid) ─────────
  // Di middleware asli, token ini dikirim dari client (header Authorization).
  const token = jwt.sign(
    { id: penggunaRaw._id, version: penggunaRaw.tokenVersion },
    PENGGUNA_JWT_SECRET,
    { expiresIn: "1h" }
  );

  // ── STEP 3: Decode token (persis seperti di middleware asli) ───
  const decoded = jwt.verify(token, PENGGUNA_JWT_SECRET);

  // ── STEP 4: Query DB — PERSIS sama dengan authPengguna.js ─────
  // Ini adalah bagian kritis yang kita verifikasi.
  const pengguna = await Pengguna.findById(decoded.id)
    .select("tokenVersion roleID nama tenantID")   // ← field yang dipilih
    .populate({
      path: "roleID",
      select: "namaRole permissions",
      populate: {
        path: "permissions",
        select: "nama grup",
      },
    })
    .lean();

  if (!pengguna) throw new Error("Data pengguna tidak ditemukan.");
  if (!pengguna.roleID) throw new Error("Role pengguna tidak valid.");
  if (pengguna.tokenVersion !== decoded.version) throw new Error("Token version mismatch.");

  // ── STEP 5: Map permissions — PERSIS sama dengan authPengguna.js
  const permissionList = pengguna.roleID.permissions || [];
  pengguna.permissions = permissionList.map((p) => p.nama);

  // ── STEP 6: Ini adalah req.pengguna yang akan diterima service ─
  return pengguna; // ← ini persis yang di-assign ke req.pengguna
}

// ==============================================================
// FUNGSI: Verifikasi struktur req.pengguna
// ==============================================================
function verifikasiStruktur(namaAkun, reqPengguna) {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`👤 Verifikasi untuk: ${namaAkun}`);
  console.log("─".repeat(55));

  const checks = [
    {
      field: "_id",
      label: "req.pengguna._id",
      tujuan: "Identitas unik pengguna",
      nilai: reqPengguna._id,
      valid: Boolean(reqPengguna._id),
    },
    {
      field: "tenantID",
      label: "req.pengguna.tenantID",
      tujuan: "Scope data per perusahaan",
      nilai: reqPengguna.tenantID,
      valid: Boolean(reqPengguna.tenantID),
    },
    {
      field: "permissions",
      label: "req.pengguna.permissions",
      tujuan: "Daftar izin yang dimiliki",
      nilai: reqPengguna.permissions,
      valid:
        Array.isArray(reqPengguna.permissions) &&
        reqPengguna.permissions.length > 0 &&
        reqPengguna.permissions.every((p) => typeof p === "string"),
    },
  ];

  let semuaLulus = true;

  for (const check of checks) {
    const icon = check.valid ? "✅" : "❌";
    const nilaiStr =
      Array.isArray(check.nilai)
        ? `Array (${check.nilai.length} items)`
        : String(check.nilai);

    console.log(`\n  ${icon} ${check.label}`);
    console.log(`     Tujuan : ${check.tujuan}`);
    console.log(`     Nilai  : ${nilaiStr}`);

    if (!check.valid) {
      semuaLulus = false;
      if (!check.nilai) {
        console.log(`     ⚠️  MASALAH: Field "${check.field}" kosong atau tidak ada!`);
      } else if (Array.isArray(check.nilai) && check.nilai.length === 0) {
        console.log(`     ⚠️  MASALAH: Array "${check.field}" kosong — role mungkin tidak punya permission!`);
      } else if (Array.isArray(check.nilai) && !check.nilai.every((p) => typeof p === "string")) {
        console.log(`     ⚠️  MASALAH: Isi array bukan string! Mungkin lupa .map(p => p.nama)`);
      }
    }
  }

  // Tampilkan isi permissions
  if (Array.isArray(reqPengguna.permissions) && reqPengguna.permissions.length > 0) {
    console.log(`\n  📋 Daftar permissions (${reqPengguna.permissions.length}):`);
    reqPengguna.permissions.forEach((p) => console.log(`     - ${p}`));
  }

  return semuaLulus;
}

// ==============================================================
// RUN SEMUA VERIFIKASI
// ==============================================================
const runCheck = async () => {
  try {
    await mongoose.connect(DB_URI);
    console.log("🔌 Terhubung ke MongoDB:", DB_URI);
    console.log("─".repeat(55));
    console.log("🔍 Verifikasi Middleware authPengguna — req.pengguna");
    console.log("─".repeat(55));
    console.log("Mensimulasikan authPengguna.js untuk semua pengguna seed...");

    const penggunaList = ["Budi Manager", "Citra Gudang", "Doni Outlet"];
    const hasilVerifikasi = {};

    for (const nama of penggunaList) {
      try {
        const reqPengguna = await simulasiAuthPengguna(nama);
        const lulus = verifikasiStruktur(nama, reqPengguna);
        hasilVerifikasi[nama] = lulus;
      } catch (err) {
        console.log(`\n  ❌ Error saat verifikasi "${nama}": ${err.message}`);
        hasilVerifikasi[nama] = false;
      }
    }

    // ── RINGKASAN AKHIR ──────────────────────────────────────────
    console.log(`\n${"=".repeat(55)}`);
    console.log("📊 RINGKASAN HASIL VERIFIKASI");
    console.log("=".repeat(55));

    let semuaLulus = true;
    for (const [nama, lulus] of Object.entries(hasilVerifikasi)) {
      const icon = lulus ? "✅" : "❌";
      console.log(`  ${icon} ${nama}`);
      if (!lulus) semuaLulus = false;
    }

    console.log("─".repeat(55));

    if (semuaLulus) {
      console.log("✅ SEMUA VERIFIKASI LULUS");
      console.log("");
      console.log("   req.pengguna._id         → Ada ✓");
      console.log("   req.pengguna.tenantID     → Ada ✓");
      console.log("   req.pengguna.permissions  → Array string ✓");
      console.log("");
      console.log("   Semua service siap menggunakan req.pengguna!");
    } else {
      console.log("❌ ADA VERIFIKASI YANG GAGAL");
      console.log("   Periksa detail di atas dan perbaiki authPengguna.js");
    }

    console.log("=".repeat(55));

    process.exit(semuaLulus ? 0 : 1);
  } catch (err) {
    console.error("\n❌ Script gagal berjalan:", err.message);
    console.error(err);
    process.exit(1);
  }
};

runCheck();
