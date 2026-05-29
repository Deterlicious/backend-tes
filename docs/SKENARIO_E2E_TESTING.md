# 📋 Skenario E2E Testing — Alur PermintaanStok → TransferStok DITERIMA

> **Tugas 22 — Panduan Manual Testing End-to-End**
> Dokumen ini menjelaskan urutan request dari awal (DRAFT) sampai barang diterima outlet.

---

## ⚙️ Prasyarat Sebelum Memulai

Pastikan semua ini sudah dijalankan dan berhasil:

```bash
# 1. Seed permissions (data izin)
node seeds/permissionSeed.js

# 2. Seed data utama (Tenant, Location, BahanBaku, Role, Pengguna)
node seeds/mainSeed.js

# 3. Seed stok awal di gudang
node seeds/inventorySeed.js

# 4. Pastikan Redis berjalan
node seeds/checkRedis.js

# 5. Jalankan server
node serverNew.js
```

**Base URL:** `http://localhost:3000`

---

## 👥 Akun Pengguna Seed (PIN semua: 123456)

| Nama | Role | Digunakan di Langkah |
|---|---|---|
| **Budi Manager** | Manager | Login, kemudian Approve permintaan |
| **Citra Gudang** | Staf Gudang | Login, kemudian Buat & Kirim Transfer |
| **Doni Outlet** | Staf Outlet | Login, Buat permintaan, Terima barang |

---

## 🗺️ Peta Alur Lengkap

```
[Doni Outlet]           [Budi Manager]        [Citra Gudang]       [Doni Outlet]
      |                       |                      |                    |
 BUAT DRAFT            APPROVE / REJECT         BUAT TRANSFER        TERIMA BARANG
 PermintaanStok   -->  PermintaanStok    -->   TransferStok   -->   TransferStok
 (status: DRAFT)       (status: APPROVED)      (status: KIRIM)      (status: TERIMA)
      |
 SUBMIT permintaan
 (status: SUBMITTED)
```

---

## 📍 LANGKAH 0 — Dapatkan Token Akun (Auth Level Pertama)

```
POST /akun/login
Content-Type: application/json

Body:
{
  "email": "admin@gmail.com",
  "password": "admin123"
}
```

> 💾 Simpan `accessToken` → sebut **AKUN_TOKEN** di langkah berikutnya.

---

## 📍 LANGKAH 1 — Login PIN sebagai Staf Outlet (Doni Outlet)

```
POST /pengguna/pin-login
Authorization: Bearer {AKUN_TOKEN}
Content-Type: application/json

Body:
{
  "nama": "Doni Outlet",
  "pin": "123456"
}
```

> 💾 Simpan `accessToken` → sebut **OUTLET_TOKEN**.

---

## 📍 LANGKAH 2 — Buat PermintaanStok DRAFT

```
POST /permintaanstok
Authorization: Bearer {OUTLET_TOKEN}
Content-Type: application/json

Body:
{
  "dariLocationID": "{ID_GUDANG}",
  "keLocationID":  "{ID_OUTLET}",
  "items": [
    { "bahanBakuID": "{ID_TEPUNG_TERIGU}", "jumlah": 10, "satuan": "kg" },
    { "bahanBakuID": "{ID_GULA_PASIR}",    "jumlah": 5,  "satuan": "kg" }
  ],
  "catatan": "Kebutuhan minggu ini",
  "tanggalKebutuhan": "2026-05-10"
}
```

> 💾 Simpan `_id` dari respons → sebut **PERMINTAAN_ID**.
> Status: **DRAFT** ✏️

---

## 📍 LANGKAH 3 — Submit (DRAFT → SUBMITTED)

```
PATCH /permintaanstok/{PERMINTAAN_ID}/submit
Authorization: Bearer {OUTLET_TOKEN}
```

> Status: **SUBMITTED** 📤

---

## 📍 LANGKAH 4 — Login PIN sebagai Manager (Budi Manager)

```
POST /pengguna/pin-login
Authorization: Bearer {AKUN_TOKEN}
Content-Type: application/json

Body:
{
  "nama": "Budi Manager",
  "pin": "123456"
}
```

> 💾 Simpan `accessToken` → sebut **MANAGER_TOKEN**.

---

## 📍 LANGKAH 5 — Lihat Daftar Permintaan (verifikasi SUBMITTED)

```
GET /permintaanstok
Authorization: Bearer {MANAGER_TOKEN}
```

---

## 📍 LANGKAH 6 — Approve (SUBMITTED → APPROVED)

```
PATCH /permintaanstok/{PERMINTAAN_ID}/approve
Authorization: Bearer {MANAGER_TOKEN}
Content-Type: application/json

Body:
{
  "catatan": "Disetujui, segera proses transfer"
}
```

> Status: **APPROVED** ✅

---

## 📍 LANGKAH 7 — Login PIN sebagai Staf Gudang (Citra Gudang)

```
POST /pengguna/pin-login
Authorization: Bearer {AKUN_TOKEN}
Content-Type: application/json

Body:
{
  "nama": "Citra Gudang",
  "pin": "123456"
}
```

> 💾 Simpan `accessToken` → sebut **GUDANG_TOKEN**.

---

## 📍 LANGKAH 8 — Buat TransferStok

```
POST /transferstok
Authorization: Bearer {GUDANG_TOKEN}
Content-Type: application/json

Body:
{
  "permintaanStokID": "{PERMINTAAN_ID}",
  "dariLocationID": "{ID_GUDANG}",
  "keLocationID": "{ID_OUTLET}",
  "items": [
    { "bahanBakuID": "{ID_TEPUNG_TERIGU}", "jumlah": 10, "satuan": "kg" },
    { "bahanBakuID": "{ID_GULA_PASIR}",    "jumlah": 5,  "satuan": "kg" }
  ],
  "catatan": "Dikirim hari ini"
}
```

> 💾 Simpan `_id` → sebut **TRANSFER_ID**.
> Status Transfer: **DRAFT** ✏️

---

## 📍 LANGKAH 9 — Kirim Barang (DRAFT → KIRIM)

```
PATCH /transferstok/{TRANSFER_ID}/kirim
Authorization: Bearer {GUDANG_TOKEN}
```

> Status Transfer: **KIRIM** 🚚
> Stok **Gudang berkurang** di tahap ini.

---

## 📍 LANGKAH 10 — Terima Barang (KIRIM → TERIMA) ✅

```
PATCH /transferstok/{TRANSFER_ID}/terima
Authorization: Bearer {OUTLET_TOKEN}
```

> Status Transfer: **TERIMA** ✅
> Status Permintaan: **COMPLETED**
> Stok **Outlet bertambah** di tahap ini.

---

## 📊 Verifikasi Hasil Akhir

### Cek Stok Gudang (harus berkurang)

```
GET /inventory
Authorization: Bearer {GUDANG_TOKEN}
```

**Expected:**
- Tepung Terigu: **90 kg** (awal 100 - dikirim 10)
- Gula Pasir: **45 kg** (awal 50 - dikirim 5)

### Cek Stok Outlet (harus bertambah)

```
GET /inventory
Authorization: Bearer {OUTLET_TOKEN}
```

**Expected:**
- Tepung Terigu: **10 kg** (dari 0)
- Gula Pasir: **5 kg** (dari 0)

### Cek Status PermintaanStok

```
GET /permintaanstok/{PERMINTAAN_ID}
Authorization: Bearer {MANAGER_TOKEN}
```

**Expected:** `"status": "COMPLETED"`

---

## 🗂️ Ringkasan Perubahan Status

| Langkah | Actor | Action | Status Permintaan | Status Transfer |
|---|---|---|---|---|
| 2 | Staf Outlet | Buat Draft | **DRAFT** | — |
| 3 | Staf Outlet | Submit | **SUBMITTED** | — |
| 6 | Manager | Approve | **APPROVED** | — |
| 8 | Staf Gudang | Buat Transfer | APPROVED | **DRAFT** |
| 9 | Staf Gudang | Kirim | APPROVED | **KIRIM** |
| 10 | Staf Outlet | Terima | **COMPLETED** | **TERIMA** |

---

## 🔀 Skenario Alternatif

### Skenario B — Manager MENOLAK permintaan

Di Langkah 6, ganti dengan endpoint reject:
```
PATCH /permintaanstok/{PERMINTAAN_ID}/reject
Authorization: Bearer {MANAGER_TOKEN}
Body: { "catatanPenolakan": "Stok tidak mencukupi bulan ini" }
```

Expected: status → **REJECTED**, tidak ada TransferStok dibuat.

### Skenario C — Gudang membatalkan transfer

Setelah Langkah 8 (sebelum kirim):
```
PATCH /transferstok/{TRANSFER_ID}/batal
Authorization: Bearer {GUDANG_TOKEN}
```

Expected: status Transfer → **BATAL**, stok gudang tidak berkurang.

---

*Dokumen ini dibuat sebagai bagian dari Tugas 22 — Pre-Test Preparation.*
