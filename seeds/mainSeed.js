/**
 * ==============================================================
 * TUGAS 19 — MAIN SEED DATA (Pre-Test Setup)
 * ==============================================================
 * File ini membuat data dummy untuk keperluan testing:
 *   - 1 Tenant (perusahaan)
 *   - 2 Location (1 Gudang + 1 Outlet)
 *   - 3 BahanBaku (Tepung, Gula, Minyak Goreng)
 *   - 3 Role (Manager, Staf Gudang, Staf Outlet)
 *   - 3 Pengguna (1 per role)
 *
 * Cara jalankan:
 *   node seeds/mainSeed.js
 * ==============================================================
 */

require("dotenv").config();
const mongoose = require("mongoose");

// ── Import semua model yang dibutuhkan ──────────────────────────
const Tenant      = require("../models/tenantModel");
const Location    = require("../models/locationModel");
const BahanBaku   = require("../models/bahanBakuModel");
const Role        = require("../models/roleModel");
const Permission  = require("../models/permissionModel");
const Pengguna    = require("../models/penggunaModel");

// ── Koneksi ke database ─────────────────────────────────────────
const DB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/db_produk";

// ==============================================================
// HELPER: Cari permission berdasarkan nama, kembalikan array ID
// ==============================================================
async function getPermissionIds(namaList) {
  const found = await Permission.find({ nama: { $in: namaList } }).select("_id nama");
  const notFound = namaList.filter(n => !found.find(p => p.nama === n));
  if (notFound.length > 0) {
    console.warn(`  ⚠️  Permission tidak ditemukan: ${notFound.join(", ")}`);
    console.warn(`     Pastikan kamu sudah menjalankan: node seeds/permissionSeed.js`);
  }
  return found.map(p => p._id);
}

// ==============================================================
// MAIN SEED FUNCTION
// ==============================================================
const runSeed = async () => {
  try {
    await mongoose.connect(DB_URI);
    console.log("🔌 Terhubung ke MongoDB:", DB_URI);
    console.log("─".repeat(55));

    // ────────────────────────────────────────────────────────
    // LANGKAH 1: Buat Tenant
    // Tenant = "pemilik" dari semua data. Harus dibuat PERTAMA
    // karena Location, BahanBaku, Role, Pengguna semuanya
    // butuh tenantID.
    // ────────────────────────────────────────────────────────
    console.log("\n📦 [1/5] Membuat Tenant...");

    let tenant = await Tenant.findOne({ namaToko: "Toko Seed Test" });
    if (tenant) {
      console.log("  ♻️  Tenant sudah ada, digunakan ulang.");
    } else {
      tenant = await Tenant.create({
        namaToko: "Toko Seed Test",
        status: "aktif",
        alamat: "Jl. Testing No. 1, Jakarta",
        kota: "Jakarta",
        kodePos: "10110",
        nomorTelepon: "081234567890",
        emailBisnis: "test@tokoseed.com",
        isSetupComplete: true,
      });
      console.log("  ✅ Tenant dibuat:", tenant.namaToko, `(ID: ${tenant._id})`);
    }

    // ────────────────────────────────────────────────────────
    // LANGKAH 2: Buat 2 Lokasi (Gudang + Outlet)
    // Location = tempat fisik barang disimpan.
    // Gudang = tempat stok pusat.
    // Outlet = tempat stok untuk penjualan.
    // ────────────────────────────────────────────────────────
    console.log("\n📍 [2/5] Membuat Location (Gudang & Outlet)...");

    let gudang = await Location.findOne({ tenantID: tenant._id, tipe: "Gudang" });
    if (gudang) {
      console.log("  ♻️  Gudang sudah ada, digunakan ulang.");
    } else {
      gudang = await Location.create({
        nama: "Gudang Pusat",
        tipe: "Gudang",
        alamat: "Jl. Gudang Raya No. 10, Jakarta",
        tenantID: tenant._id,
      });
      console.log("  ✅ Gudang dibuat:", gudang.nama, `(ID: ${gudang._id})`);
    }

    let outlet = await Location.findOne({ tenantID: tenant._id, tipe: "Outlet" });
    if (outlet) {
      console.log("  ♻️  Outlet sudah ada, digunakan ulang.");
    } else {
      outlet = await Location.create({
        nama: "Outlet Jakarta Selatan",
        tipe: "Outlet",
        alamat: "Jl. Outlet Selatan No. 5, Jakarta",
        tenantID: tenant._id,
      });
      console.log("  ✅ Outlet dibuat:", outlet.nama, `(ID: ${outlet._id})`);
    }

    // ────────────────────────────────────────────────────────
    // LANGKAH 3: Buat 3 BahanBaku
    // BahanBaku = daftar nama bahan yang bisa distok.
    // Ini adalah "definisi" bahan, bukan stoknya.
    // Stok aktual akan dibuat di file seedInventory.js (Tugas 20).
    // ────────────────────────────────────────────────────────
    console.log("\n🥣 [3/5] Membuat BahanBaku...");

    const bahanList = [
      { namaBahan: "Tepung Terigu", satuan: "kg", minimalStok: 10 },
      { namaBahan: "Gula Pasir",    satuan: "kg", minimalStok: 5  },
      { namaBahan: "Minyak Goreng", satuan: "liter", minimalStok: 5 },
    ];

    const bahanBakuDocs = [];
    for (const bahan of bahanList) {
      let doc = await BahanBaku.findOne({ tenantID: tenant._id, namaBahan: bahan.namaBahan });
      if (doc) {
        console.log(`  ♻️  BahanBaku "${bahan.namaBahan}" sudah ada, digunakan ulang.`);
      } else {
        doc = await BahanBaku.create({ ...bahan, tenantID: tenant._id });
        console.log(`  ✅ BahanBaku dibuat: ${doc.namaBahan} (${doc.satuan})`);
      }
      bahanBakuDocs.push(doc);
    }

    // ────────────────────────────────────────────────────────
    // LANGKAH 4: Buat 3 Role dengan permissions yang sesuai
    //
    // Manager     → bisa approve/reject pengajuan stok
    // Staf Gudang → bisa buat & kirim transfer stok
    // Staf Outlet → bisa buat pengajuan stok & terima barang
    //
    // Kita ambil permission dari database (yang sudah di-seed
    // oleh permissionSeed.js) berdasarkan namanya.
    // ────────────────────────────────────────────────────────
    console.log("\n🎭 [4/5] Membuat Role...");

    const roleConfigs = [
      {
        namaRole: "Manager",
        deskripsi: "Manager toko — dapat approve/reject pengajuan stok",
        permissions: [
          "read-inventory",
          "read-pengajuan-stok",
          "approve-pengajuan-stok",
          "reject-pengajuan-stok",
          "read-transfer-stok",
          "read-pengguna",
          "read-jurnal-stok",
          "read-dashboard-gudang",
          "read-dashboard-outlet",
          "create-location",
          "read-location",
          "update-location",
          "delete-location",
        ],
      },
      {
        namaRole: "Staf Gudang",
        deskripsi: "Staf gudang — kelola stok gudang dan proses transfer",
        permissions: [
          "read-inventory-gudang",
          "create-inventory",
          "update-inventory-minimum",
          "opname-inventory",
          "read-pengajuan-stok",
          "read-transfer-stok",
          "create-transfer-stok",
          "approve-transfer-stok",
          "cancel-transfer-stok",
          "read-jurnal-stok",
          "read-dashboard-gudang",
          "create-location",
          "read-location",
          "update-location",
        ],
      },
      {
        namaRole: "Staf Outlet",
        deskripsi: "Staf outlet — minta stok ke gudang dan terima barang",
        permissions: [
          "read-inventory-outlet",
          "read-pengajuan-stok",
          "create-pengajuan-stok",
          "update-pengajuan-stok",
          "read-transfer-stok",
          "receive-transfer-stok",
          "read-dashboard-outlet",
          "read-location",
        ],
      },
    ];

    const roleDocs = {};
    for (const config of roleConfigs) {
      // Ambil ID permissions dari DB berdasarkan nama
      const permIds = await getPermissionIds(config.permissions);

      let role = await Role.findOne({ tenantID: tenant._id, namaRole: config.namaRole });
      if (role) {
        // Update permissions jika role sudah ada
        role.permissions = permIds;
        role.deskripsi = config.deskripsi;
        await role.save();
        console.log(`  ♻️  Role "${config.namaRole}" sudah ada, permissions diperbarui.`);
      } else {
        role = await Role.create({
          namaRole: config.namaRole,
          deskripsi: config.deskripsi,
          tenantID: tenant._id,
          permissions: permIds,
        });
        console.log(`  ✅ Role dibuat: ${role.namaRole} (${permIds.length} permissions)`);
      }
      roleDocs[config.namaRole] = role;
    }

    // ────────────────────────────────────────────────────────
    // LANGKAH 5: Buat 3 Pengguna (1 per role)
    //
    // PIN default semua: 123456
    // PIN akan di-hash otomatis oleh model (pre-save hook).
    //
    // CATATAN: Pengguna model menggunakan PIN, bukan password.
    // Penggunaan: login dengan nama + PIN di aplikasi.
    // ────────────────────────────────────────────────────────
    console.log("\n👤 [5/5] Membuat Pengguna...");

    const penggunaList = [
      {
        nama: "Budi Manager",
        pin: "123456",
        roleID: roleDocs["Manager"]._id,
        nomorHp: "081111111111",
      },
      {
        nama: "Citra Gudang",
        pin: "123456",
        roleID: roleDocs["Staf Gudang"]._id,
        nomorHp: "082222222222",
      },
      {
        nama: "Doni Outlet",
        pin: "123456",
        roleID: roleDocs["Staf Outlet"]._id,
        nomorHp: "083333333333",
      },
    ];

    for (const data of penggunaList) {
      let pengguna = await Pengguna.findOne({ tenantID: tenant._id, nama: data.nama });
      if (pengguna) {
        console.log(`  ♻️  Pengguna "${data.nama}" sudah ada, dilewati.`);
      } else {
        pengguna = await Pengguna.create({ ...data, tenantID: tenant._id });
        console.log(`  ✅ Pengguna dibuat: ${pengguna.nama} (Role: ${data.roleID})`);
      }
    }

    // ────────────────────────────────────────────────────────
    // RINGKASAN HASIL SEED
    // ────────────────────────────────────────────────────────
    console.log("\n" + "=".repeat(55));
    console.log("✅ SEED SELESAI — Ringkasan Data:");
    console.log("=".repeat(55));
    console.log(`  Tenant  : ${tenant.namaToko}`);
    console.log(`  Gudang  : ${gudang.nama} (ID: ${gudang._id})`);
    console.log(`  Outlet  : ${outlet.nama} (ID: ${outlet._id})`);
    console.log(`  BahanBaku (${bahanBakuDocs.length}):`);
    bahanBakuDocs.forEach(b => console.log(`    - ${b.namaBahan} [${b.satuan}] (ID: ${b._id})`));
    console.log(`  Role    : Manager, Staf Gudang, Staf Outlet`);
    console.log(`  Pengguna: Budi Manager / Citra Gudang / Doni Outlet`);
    console.log(`  PIN default semua: 123456`);
    console.log("=".repeat(55));
    console.log("\n📋 Simpan ID-ID di atas untuk Tugas 20 (Seed Inventory)");
    console.log("   atau jalankan: node seeds/inventorySeed.js\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ SEED GAGAL:", err.message);
    if (err.code === 11000) {
      console.error("   → Ada data duplikat. Coba hapus data lama di database terlebih dahulu.");
    }
    console.error(err);
    process.exit(1);
  }
};

runSeed();
