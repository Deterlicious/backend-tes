/**
 * ==============================================================
 * TUGAS 20 — SEED INVENTORY AWAL (Pre-Test Setup)
 * ==============================================================
 * File ini mengisi stok awal di Gudang untuk semua BahanBaku
 * yang sudah dibuat oleh mainSeed.js (Tugas 19).
 *
 * Aturan stok awal:
 *   - Gudang Pusat  → DIISI stok (ini sumber stok)
 *   - Outlet        → KOSONG (supaya flow permintaan bisa ditest)
 *
 * Flow yang akan bisa ditest setelah ini:
 *   Outlet (stok 0) → buat PermintaanStok → Manager approve
 *   → Staf Gudang buat TransferStok → Outlet terima barang ✅
 *
 * Cara jalankan:
 *   node seeds/inventorySeed.js
 *
 * PERHATIAN: Jalankan mainSeed.js terlebih dahulu!
 * ==============================================================
 */

require("dotenv").config();
const mongoose = require("mongoose");

// ── Import model yang dibutuhkan ────────────────────────────────
const Tenant    = require("../models/tenantModel");
const Location  = require("../models/locationModel");
const BahanBaku = require("../models/bahanBakuModel");
const Inventory = require("../models/inventoryModel");

const DB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk";

// ==============================================================
// KONFIGURASI STOK AWAL
// Ubah angka di sini sesuai kebutuhan testing
// ==============================================================
const STOK_AWAL_GUDANG = [
  { namaBahan: "Tepung Terigu", stok: 100, stokMinimum: 20 },
  { namaBahan: "Gula Pasir",    stok: 50,  stokMinimum: 10 },
  { namaBahan: "Minyak Goreng", stok: 40,  stokMinimum: 10 },
];
// Outlet sengaja tidak diisi → stok = 0 (default dari model)

// ==============================================================
// MAIN SEED FUNCTION
// ==============================================================
const runSeed = async () => {
  try {
    await mongoose.connect(DB_URI);
    console.log("🔌 Terhubung ke MongoDB:", DB_URI);
    console.log("─".repeat(55));

    // ────────────────────────────────────────────────────────
    // LANGKAH 1: Temukan Tenant dari hasil mainSeed.js
    // Kita cari berdasarkan nama yang sudah dibuat sebelumnya.
    // ────────────────────────────────────────────────────────
    console.log("\n🔍 [1/4] Mencari data dari mainSeed.js...");

    const tenant = await Tenant.findOne({ namaToko: "Toko Seed Test" });
    if (!tenant) {
      console.error("❌ Tenant 'Toko Seed Test' tidak ditemukan.");
      console.error("   → Pastikan kamu sudah menjalankan: node seeds/mainSeed.js");
      process.exit(1);
    }
    console.log(`  ✅ Tenant ditemukan: ${tenant.namaToko}`);

    // ────────────────────────────────────────────────────────
    // LANGKAH 2: Temukan Lokasi Gudang
    // ────────────────────────────────────────────────────────
    const gudang = await Location.findOne({ tenantID: tenant._id, tipe: "Gudang" });
    if (!gudang) {
      console.error("❌ Gudang tidak ditemukan untuk tenant ini.");
      console.error("   → Pastikan kamu sudah menjalankan: node seeds/mainSeed.js");
      process.exit(1);
    }
    console.log(`  ✅ Gudang ditemukan: ${gudang.nama} (ID: ${gudang._id})`);

    const outlet = await Location.findOne({ tenantID: tenant._id, tipe: "Outlet" });
    if (!outlet) {
      console.error("❌ Outlet tidak ditemukan untuk tenant ini.");
      process.exit(1);
    }
    console.log(`  ✅ Outlet ditemukan: ${outlet.nama} (ID: ${outlet._id})`);

    // ────────────────────────────────────────────────────────
    // LANGKAH 3: Isi stok gudang untuk setiap BahanBaku
    //
    // Cara kerja:
    // - Cari BahanBaku berdasarkan nama
    // - Cek apakah Inventory untuk bahan ini di Gudang sudah ada
    // - Kalau sudah ada → update stoknya
    // - Kalau belum    → buat baru
    // ────────────────────────────────────────────────────────
    console.log("\n📦 [2/4] Mengisi stok Gudang...");

    const inventoryGudangDocs = [];
    for (const config of STOK_AWAL_GUDANG) {
      // Cari BahanBaku berdasarkan nama
      const bahan = await BahanBaku.findOne({
        tenantID: tenant._id,
        namaBahan: config.namaBahan,
      });

      if (!bahan) {
        console.warn(`  ⚠️  BahanBaku "${config.namaBahan}" tidak ditemukan, dilewati.`);
        continue;
      }

      // Cek apakah inventory sudah ada (findOne dengan kombinasi lokasi + bahan)
      let inv = await Inventory.findOne({
        tenantID: tenant._id,
        locationID: gudang._id,
        bahanBakuID: bahan._id,
      });

      if (inv) {
        // Update stok yang sudah ada
        const stokLama = inv.stok;
        inv.stok = config.stok;
        inv.stokMinimum = config.stokMinimum;
        await inv.save();
        console.log(
          `  ♻️  Inventory gudang "${config.namaBahan}" diperbarui: ${stokLama} → ${config.stok} ${bahan.satuan}`
        );
      } else {
        // Buat inventory baru
        inv = await Inventory.create({
          tenantID: tenant._id,
          locationID: gudang._id,
          bahanBakuID: bahan._id,
          stok: config.stok,
          stokMinimum: config.stokMinimum,
        });
        console.log(
          `  ✅ Inventory gudang dibuat: ${config.namaBahan} = ${config.stok} ${bahan.satuan}`
        );
      }
      inventoryGudangDocs.push({ bahan, inv });
    }

    // ────────────────────────────────────────────────────────
    // LANGKAH 4: Pastikan outlet TIDAK punya stok
    // (Atau kalau sudah ada, set ke 0 supaya flow bisa ditest)
    //
    // Ini penting! Kalau outlet sudah punya stok dari run
    // sebelumnya, kita reset ke 0 agar test flow berjalan benar.
    // ────────────────────────────────────────────────────────
    console.log("\n🏪 [3/4] Memastikan stok Outlet = 0 (untuk keperluan test)...");

    for (const { bahan } of inventoryGudangDocs) {
      const invOutlet = await Inventory.findOne({
        tenantID: tenant._id,
        locationID: outlet._id,
        bahanBakuID: bahan._id,
      });

      if (invOutlet) {
        if (invOutlet.stok > 0) {
          invOutlet.stok = 0;
          await invOutlet.save();
          console.log(`  🔄 Stok outlet "${bahan.namaBahan}" direset ke 0`);
        } else {
          console.log(`  ✅ Stok outlet "${bahan.namaBahan}" sudah 0, tidak perlu reset.`);
        }
      } else {
        // Tidak perlu buat inventory outlet dengan stok 0 —
        // inventory hanya dibuat saat ada transfer masuk.
        console.log(`  ✅ Inventory outlet "${bahan.namaBahan}" belum ada (stok 0 by default).`);
      }
    }

    // ────────────────────────────────────────────────────────
    // RINGKASAN HASIL
    // ────────────────────────────────────────────────────────
    console.log("\n" + "=".repeat(55));
    console.log("✅ SEED INVENTORY SELESAI — Ringkasan Stok Gudang:");
    console.log("=".repeat(55));
    console.log(`  Lokasi : ${gudang.nama}`);
    console.log(`  Stok   :`);
    for (const config of STOK_AWAL_GUDANG) {
      console.log(`    - ${config.namaBahan.padEnd(18)}: ${String(config.stok).padStart(4)} unit (min: ${config.stokMinimum})`);
    }
    console.log("─".repeat(55));
    console.log(`  Lokasi : ${outlet.nama}`);
    console.log(`  Stok   : 0 (kosong — siap untuk test PermintaanStok)`);
    console.log("=".repeat(55));
    console.log(`
📋 Flow yang siap ditest:
   1. Login sebagai Doni Outlet (PIN: 123456)
   2. Buat PermintaanStok dari Outlet ke Gudang
   3. Login sebagai Budi Manager → Approve
   4. Login sebagai Citra Gudang → Buat & Kirim TransferStok
   5. Login sebagai Doni Outlet → Terima barang ✅
`);

    process.exit(0);
  } catch (err) {
    console.error("\n❌ SEED INVENTORY GAGAL:", err.message);
    if (err.code === 11000) {
      console.error("   → Ada konflik data duplikat di database.");
    }
    console.error(err);
    process.exit(1);
  }
};

runSeed();
