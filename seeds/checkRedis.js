/**
 * ==============================================================
 * TUGAS 21 — CEK KONEKSI REDIS
 * ==============================================================
 * Script ini memverifikasi bahwa:
 *   1. Redis bisa dikoneksi dari config yang ada di .env
 *   2. Redis bisa MENULIS data (SET)
 *   3. Redis bisa MEMBACA data (GET)
 *   4. Redis bisa MENGHAPUS data (DEL)
 *
 * Cara jalankan:
 *   node seeds/checkRedis.js
 * ==============================================================
 */

require("dotenv").config();
const Redis = require("ioredis");

// ── Ambil konfigurasi dari .env ─────────────────────────────────
const host     = process.env.REDIS_HOST || "127.0.0.1";
const port     = process.env.REDIS_PORT || 6379;
const password = process.env.REDIS_PASSWORD || undefined;

console.log("─".repeat(55));
console.log("🔍 Mengecek Konfigurasi Redis...");
console.log("─".repeat(55));
console.log(`  REDIS_HOST     : ${host}`);
console.log(`  REDIS_PORT     : ${port}`);
console.log(`  REDIS_PASSWORD : ${password ? "****** (terisi)" : "(kosong/tidak dipakai)"}`);
console.log("─".repeat(55));

// ── Buat koneksi Redis ──────────────────────────────────────────
const redis = new Redis({
  host,
  port: Number(port),
  password: password || undefined,
  // Timeout 3 detik — jika gagal langsung tahu
  connectTimeout: 3000,
  // Jangan retry terus-terusan di script ini
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // Langsung gagal jika tidak bisa connect
});

// ── Jalankan test ───────────────────────────────────────────────
const runCheck = async () => {
  try {
    // ── TEST 1: Ping ──────────────────────────────────────────
    console.log("\n[TEST 1] Ping ke Redis server...");
    const pong = await redis.ping();
    if (pong === "PONG") {
      console.log("  ✅ Redis merespons: PONG");
    } else {
      throw new Error(`Respon tidak terduga: ${pong}`);
    }

    // ── TEST 2: SET (tulis data) ──────────────────────────────
    console.log("\n[TEST 2] Menulis data ke Redis (SET)...");
    await redis.set("__redis_check__", "berhasil", "EX", 10); // expire 10 detik
    console.log("  ✅ Data berhasil ditulis (key: __redis_check__, expire: 10s)");

    // ── TEST 3: GET (baca data) ──────────────────────────────
    console.log("\n[TEST 3] Membaca data dari Redis (GET)...");
    const value = await redis.get("__redis_check__");
    if (value === "berhasil") {
      console.log(`  ✅ Data berhasil dibaca: "${value}"`);
    } else {
      throw new Error(`Nilai tidak sesuai: dapat "${value}", ekspektasi "berhasil"`);
    }

    // ── TEST 4: DEL (hapus data) ──────────────────────────────
    console.log("\n[TEST 4] Menghapus data test dari Redis (DEL)...");
    await redis.del("__redis_check__");
    const afterDel = await redis.get("__redis_check__");
    if (afterDel === null) {
      console.log("  ✅ Data berhasil dihapus (nilai sekarang: null)");
    } else {
      throw new Error("Data seharusnya sudah terhapus tapi masih ada.");
    }

    // ── SEMUA TEST LULUS ──────────────────────────────────────
    console.log("\n" + "=".repeat(55));
    console.log("✅ REDIS OK — Semua test berhasil!");
    console.log("=".repeat(55));
    console.log(`  Host     : ${host}:${port}`);
    console.log(`  Status   : Terhubung & berfungsi normal`);
    console.log(`  Siap untuk : Inventory Service & Permintaan Stok`);
    console.log("=".repeat(55));

    redis.disconnect();
    process.exit(0);

  } catch (err) {
    console.log("\n" + "=".repeat(55));
    console.error("❌ REDIS GAGAL — Koneksi bermasalah!");
    console.log("=".repeat(55));
    console.error(`  Error    : ${err.message}`);
    console.log("\n📋 Cara mengatasi masalah Redis:");
    console.log("─".repeat(55));
    console.log("  1. Pastikan Redis server sudah berjalan.");
    console.log("     Windows (WSL)  : wsl redis-server");
    console.log("     Windows native : redis-server.exe");
    console.log("     Docker         : docker run -p 6379:6379 redis");
    console.log("");
    console.log("  2. Cek file .env kamu:");
    console.log("     REDIS_HOST=127.0.0.1");
    console.log("     REDIS_PORT=6379");
    console.log("     REDIS_PASSWORD=   (kosongkan jika tidak ada password)");
    console.log("");
    console.log("  3. Test manual via terminal:");
    console.log("     redis-cli ping   (harus dapat respon: PONG)");
    console.log("=".repeat(55));

    redis.disconnect();
    process.exit(1);
  }
};

// ── Handle event error Redis sebelum connect ────────────────────
redis.on("error", (err) => {
  // Ditangani di runCheck catch block, suppress log duplikat
  if (err.code !== "ECONNREFUSED" && err.code !== "ETIMEDOUT") {
    console.error("Redis event error:", err.message);
  }
});

runCheck();
