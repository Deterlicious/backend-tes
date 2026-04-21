# README — WMS Testing Scenarios & Backend Logic
**Tachyon POS — Modul Warehouse Management System**

Dokumen ini adalah panduan pengujian berbasis Role-Based Access (RBA) untuk modul WMS.
Setiap skenario mencakup: siapa yang melakukan, apa yang dilakukan, hasil yang diharapkan,
dan logika backend yang harus diimplementasikan.

---

## Daftar Isi

1. [Daftar Role & Hak Akses](#1-daftar-role--hak-akses)
2. [Data Awal (Seed untuk Testing)](#2-data-awal-seed-untuk-testing)
3. [Modul: Inventaris Stok](#3-modul-inventaris-stok)
4. [Modul: Permintaan Stok](#4-modul-permintaan-stok)
5. [Modul: Transfer Stok (Surat Jalan)](#5-modul-transfer-stok-surat-jalan)
6. [Skenario Lintas Modul (End-to-End)](#6-skenario-lintas-modul-end-to-end)
7. [Matriks Otorisasi API Endpoint](#7-matriks-otorisasi-api-endpoint)
8. [Logika Backend: State Machine & Business Rules](#8-logika-backend-state-machine--business-rules)

---

## 1. Daftar Role & Hak Akses

| Role | Representasi | Scope Data | Ringkasan Hak |
|---|---|---|---|
| `owner` | Pemilik bisnis | Semua lokasi | Akses penuh. Satu-satunya yang bisa approve Transfer Antar-Cabang |
| `admin_gudang` | Admin/manajer gudang pusat | Semua lokasi | Kelola transfer & permintaan. Tidak bisa approve IBT |
| `staff_outlet` | Kasir/staf di outlet | Lokasi sendiri saja | Baca inventaris lokal, buat permintaan stok, konfirmasi terima |

### Pembatasan Kritis per Role

```
staff_outlet:
  ✅ Lihat inventaris outlet sendiri
  ✅ Buat PermintaanStok (dari outlet sendiri ke gudang)
  ✅ Konfirmasi terima barang (jika ke.id === currentUser.lokasiId)
  ❌ Lihat stok lokasi lain
  ❌ Buat draf TransferStok
  ❌ Approve / proses kirim transfer
  ❌ Batalkan transfer
  ❌ Edit stok minimum
  ❌ Opname / koreksi stok

admin_gudang:
  ✅ Semua akses staff_outlet
  ✅ Lihat inventaris semua lokasi
  ✅ Buat draf TransferStok (semua tipe kecuali IBT)
  ✅ Approve & proses kirim transfer (Gudang↔Outlet)
  ✅ Setujui / tolak PermintaanStok
  ✅ Edit stok minimum
  ✅ Opname / koreksi stok
  ❌ Approve Transfer Antar-Cabang (IBT outlet → outlet)
  ❌ Buat draf TransferStok bertipe IBT

owner:
  ✅ Semua akses admin_gudang
  ✅ Buat draf TransferStok bertipe IBT
  ✅ Approve Transfer Antar-Cabang (IBT)
```

---

## 2. Data Awal (Seed untuk Testing)

### Lokasi

| ID | Nama | Tipe |
|---|---|---|
| `l1` | Gudang Pusat | `gudang` |
| `l2` | Outlet Sudirman | `outlet` |
| `l3` | Outlet Gajah Mada | `outlet` |
| `l4` | Outlet Ahmad Yani | `outlet` |

### Pengguna Uji

| ID | Nama | Role | Lokasi |
|---|---|---|---|
| `u1` | Zainuddin | `admin_gudang` | Gudang Pusat (l1) |
| `u2` | Budi | `staff_outlet` | Outlet Sudirman (l2) |
| `u3` | Dewi | `owner` | Gudang Pusat (l1) |

### Bahan Baku

| ID | Nama | Satuan | Kategori |
|---|---|---|---|
| `b1` | Tepung Terigu | kg | Bahan Kering |
| `b2` | Gula Pasir | kg | Bahan Kering |
| `b3` | Susu UHT | liter | Cairan |
| `b4` | Kopi Arabica | kg | Bahan Kering |
| `b5` | Coklat Bubuk | kg | Bahan Kering |
| `b6` | Creamer | kg | Bahan Kering |
| `b7` | Gelas Plastik 16oz | pcs | Kemasan |

### Stok Awal (Inventory)

| Bahan Baku | Gudang Pusat | Sudirman | Gajah Mada | Keterangan |
|---|---|---|---|---|
| Tepung Terigu | 120 kg (min 50) | 15 kg (min 10) | 30 kg (min 10) | — |
| Gula Pasir | 85 kg (min 30) | 12 kg (min 8) | — | — |
| Susu UHT | 48 L (min 20) | — | 18 L (min 8) | — |
| Kopi Arabica | **12 kg (min 15)** | **4 kg (min 5)** | — | ⚠ Kritis di 2 lokasi |
| Coklat Bubuk | **5 kg (min 10)** | — | — | ⚠ Kritis di gudang |
| Gelas Plastik | 500 pcs (min 100) | **50 pcs (min 100)** | — | ⚠ Kritis di outlet |

### Transfer Stok Awal (Dummy)

| ID | Nomor | Dari | Ke | Status | Catatan Skenario |
|---|---|---|---|---|---|
| `t1` | TRF-001 | Gudang Pusat | Outlet Sudirman | `DIKIRIM` | Uji konfirmasi terima |
| `t2` | TRF-002 | Outlet Sudirman | Gudang Pusat | `PENDING` | Uji retur stok |
| `t3` | TRF-003 | Outlet Sudirman | Outlet Gajah Mada | `PENDING` | Uji IBT |

---

## 3. Modul: Inventaris Stok

### TC-INV-01 — Admin melihat semua stok lintas lokasi

**Role:** `admin_gudang` atau `owner`
**Aksi:** Buka halaman Inventaris Stok

**Hasil yang diharapkan:**
- Tabel menampilkan semua 12 record inventory dari semua lokasi
- Filter lokasi (Semua / Gudang Pusat / Outlet A / dst) berfungsi
- Filter kategori (Bahan Kering / Cairan / Kemasan) berfungsi
- Search bar memfilter berdasarkan nama bahan baku
- Item dengan `stok <= stokMinimum` tampil dengan label "Kritis" (merah)
- Item dengan `stok <= stokMinimum * 1.5` tampil label "Waspada" (kuning)
- Tombol "Opname" tampil di kolom Aksi

**Backend logic:**
```
GET /api/inventory
Query params: lokasiId?, kategori?, search?
Auth: authPengguna
Guard: if (pengguna.role === 'staff_outlet') → filter WHERE lokasi.id = pengguna.lokasiId
Response: InventoryItem[] dengan populate bahanBaku & lokasi
```

---

### TC-INV-02 — Staff outlet hanya melihat stok lokasi sendiri

**Role:** `staff_outlet` (Budi, lokasiId: l2)
**Aksi:** Buka halaman Inventaris Stok

**Hasil yang diharapkan:**
- Tabel hanya menampilkan stok Outlet Sudirman (3 item)
- Filter lokasi tidak tampil (tidak relevan)
- Tombol "Opname" tidak tampil
- Kolom minimum tampil tapi tidak bisa diklik untuk edit

**Backend logic:**
```
GET /api/inventory
Guard: role === 'staff_outlet' → tambahkan filter lokasiId otomatis dari token
Middleware: authPengguna → req.pengguna.lokasiId
```

---

### TC-INV-03 — Admin edit batas minimum stok

**Role:** `admin_gudang` atau `owner`
**Aksi:** Klik angka minimum pada baris "Kopi Arabica — Gudang Pusat" → ubah dari 15 menjadi 20 → Simpan

**Hasil yang diharapkan:**
- Batas minimum record `i4` berubah menjadi 20
- Stok 12 kg sekarang di bawah minimum 20 → status berubah menjadi "Kritis"
- Toast success muncul
- Modal tertutup

**Backend logic:**
```
PATCH /api/inventory/:id/minimum
Body: { stokMinimum: 20 }
Auth: authPengguna
Guard: role !== 'staff_outlet' (403 jika staff)
Action: Inventory.findOneAndUpdate({ _id, tenantID }, { stokMinimum })
```

---

### TC-INV-04 — Staff outlet GAGAL edit minimum

**Role:** `staff_outlet`
**Aksi:** (Di frontend: tombol tidak tampil. Di backend: simulasi request langsung)

**Hasil yang diharapkan:**
- Frontend: tombol edit tidak dirender
- Backend: HTTP 403 Forbidden

**Backend logic:**
```
PATCH /api/inventory/:id/minimum
Guard: if (req.pengguna.role === 'staff_outlet') → throw 403
```

---

### TC-INV-05 — Admin lakukan Opname (koreksi stok fisik)

**Role:** `admin_gudang` atau `owner`
**Aksi:** Klik "Opname" pada baris "Coklat Bubuk — Gudang Pusat" (stok sistem: 5) → isi stok aktual: 3 → isi alasan: "Cek fisik, 2 kg tumpah" → Konfirmasi

**Hasil yang diharapkan:**
- Stok Coklat Bubuk di Gudang Pusat berubah dari 5 menjadi 3
- JurnalStok baru dibuat: `{ tipe: "koreksi", qty: -2, sumber: "Opname", noDokumen: "KOR-..." }`
- Toast success muncul

**Backend logic:**
```
POST /api/inventory/:id/opname
Body: { fisikAktual: 3, catatan: "Cek fisik, 2 kg tumpah" }
Auth: authPengguna
Guard: role !== 'staff_outlet'
Transaksi atomik:
  1. delta = fisikAktual - inventory.stok  → -2
  2. Inventory.findByIdAndUpdate({ stok: fisikAktual })
  3. JurnalStok.create({ tipe: "koreksi", qty: delta, catatan, inventoryId, sumber: "Opname" })
```

---

## 4. Modul: Permintaan Stok

### TC-REQ-01 — Staff outlet buat permintaan stok

**Role:** `staff_outlet` (Budi, lokasiId: l2)
**Aksi:** Klik "Buat Permintaan" → Outlet terpilih otomatis: Outlet Sudirman → pilih Kopi Arabica → qty 8 → catatan "Stok habis, mendesak" → Kirim

**Hasil yang diharapkan:**
- `formPermintaan.outletId` otomatis terisi `currentUser.lokasiId` (l2), tidak bisa diubah
- PermintaanStok baru dibuat dengan status `PENDING`
- Nomor dokumen otomatis: `REQ-YYYYMMDD-XXX`
- Redirect ke daftar permintaan
- Dokumen baru muncul paling atas dengan badge "Menunggu"

**Backend logic:**
```
POST /api/permintaan-stok
Body: { outletId, gudangId, items: [{ bahanBakuId, qtyDiminta }], catatan }
Auth: authPengguna
Guard: role === 'staff_outlet' (hanya outlet yang bisa request)
Validasi:
  - outletId HARUS sama dengan pengguna.lokasiId (cegah spoof request atas nama outlet lain)
  - outletId.tipe === 'outlet'
  - gudangId.tipe === 'gudang'
  - qtyDiminta > 0
Action:
  PermintaanStok.create({ ...body, status: "PENDING", noDokumen: generateNoDok(), tenantID })
```

---

### TC-REQ-02 — Staff outlet GAGAL request atas nama outlet lain

**Role:** `staff_outlet` (Budi, lokasiId: l2)
**Aksi:** Request dengan `outletId: "l3"` (Gajah Mada) langsung via API

**Hasil yang diharapkan:**
- HTTP 403: "Anda hanya bisa membuat permintaan atas nama outlet Anda sendiri"

**Backend logic:**
```
POST /api/permintaan-stok
Guard: if (body.outletId !== req.pengguna.lokasiId) → throw 403
```

---

### TC-REQ-03 — Admin setujui permintaan (stok mencukupi)

**Role:** `admin_gudang` (Zainuddin)
**Aksi:** Buka REQ-001 (Kopi Arabica 8 kg dari Sudirman) → klik "Setujui & Buat Draf Transfer"

**Pre-kondisi:** Stok Kopi Arabica di Gudang Pusat = 12 kg, diminta = 8 kg → cukup

**Hasil yang diharapkan:**
- Status PermintaanStok berubah menjadi `DISETUJUI`
- `transferStokId` diisi dengan noDokumen dari TransferStok baru
- TransferStok baru dibuat otomatis: `{ dari: gudang, ke: outlet, status: "PENDING", items: [...] }`
- Toast: "Permintaan disetujui. Draf Surat Jalan berhasil dibuat."
- Di tab Transfer, dokumen PENDING baru muncul dengan keterangan "Otomatis dibuat dari Permintaan: REQ-001"

**Backend logic:**
```
POST /api/permintaan-stok/:id/setujui
Auth: authPengguna
Guard: role === 'admin_gudang' || role === 'owner'
Validasi stok:
  for each item in req.items:
    stokGudang = Inventory.findOne({ bahanBakuId, lokasiId: req.gudangId })
    if stokGudang.stok < item.qtyDiminta → throw 400 "Stok tidak mencukupi: {nama}"
Transaksi atomik:
  1. PermintaanStok.update({ status: "DISETUJUI", transferStokId: newTrf.noDokumen })
  2. TransferStok.create({
       noDokumen, dari: gudang, ke: outlet,
       status: "PENDING", items, tenantID,
       catatan: "Otomatis dari " + req.noDokumen
     })
```

---

### TC-REQ-04 — Admin GAGAL setujui (stok tidak cukup)

**Role:** `admin_gudang`
**Aksi:** Setujui permintaan Coklat Bubuk 10 kg, stok gudang hanya 5 kg

**Hasil yang diharapkan:**
- Frontend: tombol "Setujui" disabled + label "Stok Tidak Cukup" (merah)
- Backend: HTTP 400 dengan detail item yang tidak cukup

**Backend logic:**
```
POST /api/permintaan-stok/:id/setujui
Validasi: stokGudang(b5, l1) = 5 < 10 diminta → HTTP 400
Body response: { error: "Stok tidak mencukupi", items: [{ nama: "Coklat Bubuk", stokAda: 5, diminta: 10 }] }
```

---

### TC-REQ-05 — Admin tolak permintaan

**Role:** `admin_gudang`
**Aksi:** Klik "Tolak" pada REQ-001

**Hasil yang diharapkan:**
- Status PermintaanStok berubah menjadi `DITOLAK`
- Tidak ada TransferStok yang dibuat
- Stok tidak berubah

**Backend logic:**
```
POST /api/permintaan-stok/:id/tolak
Body: { catatanPenolakan? }
Auth: authPengguna
Guard: role !== 'staff_outlet'
Action: PermintaanStok.update({ status: "DITOLAK" })
Note: tidak ada perubahan Inventory
```

---

### TC-REQ-06 — Staff outlet hanya melihat permintaan miliknya

**Role:** `staff_outlet` (Budi, lokasiId: l2)

**Hasil yang diharapkan:**
- Hanya permintaan dengan `outlet.id === l2` yang tampil
- Tidak bisa melihat permintaan outlet lain

**Backend logic:**
```
GET /api/permintaan-stok
Guard: role === 'staff_outlet' → tambahkan filter { outletId: req.pengguna.lokasiId }
```

---

## 5. Modul: Transfer Stok (Surat Jalan)

### TC-TRF-01 — Admin buat draf Transfer (Gudang → Outlet)

**Role:** `admin_gudang`
**Aksi:** Buat Transfer Baru → Dari: Gudang Pusat → Ke: Outlet Ahmad Yani → Creamer 8 kg → Simpan Draf

**Pre-kondisi:** Stok Creamer di Gudang Pusat cukup

**Hasil yang diharapkan:**
- TransferStok dibuat dengan status `PENDING`
- Stok BELUM berubah (stok baru berkurang saat DIKIRIM)
- Dokumen muncul di daftar dengan badge "Menunggu Approval"

**Backend logic:**
```
POST /api/transfer-stok
Body: { dariId, keId, items: [{ bahanBakuId, qtyKirim }], catatan }
Auth: authPengguna
Guard: role !== 'staff_outlet'
Guard IBT: if (dari.tipe === 'outlet' && ke.tipe === 'outlet' && role !== 'owner') → 403
Validasi:
  - dariId !== keId
  - Inventory.stok(bahanBakuId, dariId) >= qtyKirim (cek stok ada, belum dikurangi)
  - dari & ke harus dalam tenantID yang sama
Action: TransferStok.create({ status: "PENDING", ... })
Note: TIDAK ada perubahan Inventory di tahap ini
```

---

### TC-TRF-02 — Staff outlet GAGAL buat draf transfer

**Role:** `staff_outlet`
**Aksi:** (Frontend: tombol "Buat Draf Transfer" tidak tampil. Backend: POST langsung)

**Hasil yang diharapkan:**
- HTTP 403 Forbidden

---

### TC-TRF-03 — Admin proses kirim (PENDING → DIKIRIM)

**Role:** `admin_gudang`
**Aksi:** Klik "Approve & Kirim Barang" pada TRF-001 (Gudang → Outlet Sudirman, Tepung 20 kg)

**Hasil yang diharapkan:**
- Status TransferStok berubah menjadi `DIKIRIM`
- Stok Tepung di Gudang Pusat BERKURANG 20 kg (120 → 100)
- Stok di Outlet Sudirman BELUM bertambah (barang masih di jalan)
- JurnalStok dibuat: `{ tipe: "keluar", qty: 20, lokasi: l1, sumber: "Transfer", noDokumen }`
- Toast: "Surat Jalan diterbitkan. Barang dalam perjalanan."

**Backend logic:**
```
POST /api/transfer-stok/:id/kirim
Auth: authPengguna
Guard: role !== 'staff_outlet'
Guard IBT: if (dari.tipe === 'outlet' && ke.tipe === 'outlet' && role !== 'owner') → 403
Re-validasi stok (bisa berubah sejak draf dibuat):
  for each item: Inventory.stok(bahanBakuId, dariId) >= qtyKirim → else 400
Transaksi atomik:
  1. TransferStok.update({ status: "DIKIRIM" })
  2. for each item:
       Inventory.decrement({ bahanBakuId, lokasiId: dariId }, qtyKirim)
  3. JurnalStok.create({ tipe: "keluar", ... }) per item
```

---

### TC-TRF-04 — Admin GAGAL approve IBT (transfer antar-outlet)

**Role:** `admin_gudang`
**Aksi:** Klik "Approve & Kirim" pada TRF-003 (Outlet Sudirman → Outlet Gajah Mada)

**Hasil yang diharapkan:**
- Frontend: tombol "Approve" diganti badge "Menunggu Approval Owner"
- Backend: HTTP 403 "Transfer Antar-Cabang hanya bisa di-approve oleh Owner"

**Backend logic:**
```
POST /api/transfer-stok/:id/kirim
Guard: if (trf.dari.tipe === 'outlet' && trf.ke.tipe === 'outlet') {
  if (req.pengguna.role !== 'owner') → throw 403
}
```

---

### TC-TRF-05 — Owner approve IBT (transfer antar-outlet)

**Role:** `owner` (Dewi)
**Aksi:** Klik "Approve & Kirim" pada TRF-003 (Outlet Sudirman → Outlet Gajah Mada, Tepung 10 kg)

**Pre-kondisi:** Stok Tepung di Outlet Sudirman = 15 kg, diminta 10 kg

**Hasil yang diharapkan:**
- Status berubah `DIKIRIM`
- Stok Tepung Sudirman turun: 15 → 5
- Stok Tepung Gajah Mada BELUM bertambah
- JurnalStok keluar dibuat untuk lokasi l2

---

### TC-TRF-06 — Konfirmasi terima barang (DIKIRIM → DITERIMA), normal

**Role:** `staff_outlet` (Budi, Outlet Sudirman)
**Aksi:** Klik "Konfirmasi Diterima" pada TRF-001 → qty terima = sama dengan qty kirim (20 kg)

**Hasil yang diharapkan:**
- Modal konfirmasi muncul, semua qty default = qtyKirim
- Setelah submit: status `DITERIMA`
- Stok Tepung di Outlet Sudirman BERTAMBAH 20 kg
- JurnalStok dibuat: `{ tipe: "masuk", qty: 20, lokasi: l2, sumber: "Transfer" }`
- Field `qtyTerima` diisi di dalam `items[]`

**Backend logic:**
```
POST /api/transfer-stok/:id/terima
Body: { items: [{ bahanBakuId, qtyTerima }] }
Auth: authPengguna
Guard: req.pengguna.lokasiId === trf.ke.id || role === 'owner'
Transaksi atomik:
  1. TransferStok.update({ status: "DITERIMA", items[i].qtyTerima })
  2. for each item:
       qty = body.items.find(bahanBakuId).qtyTerima
       if (Inventory exists for ke.id) → Inventory.increment(qty)
       else → Inventory.create({ bahanBakuId, lokasiId: ke.id, stok: qty, stokMinimum: 0 })
  3. JurnalStok.create({ tipe: "masuk", qty, lokasi: ke, sumber: "Transfer" }) per item
  4. if (qtyTerima < qtyKirim):
       JurnalTransfer.create({ bahanBakuId, qtyKirim, qtyTerima, selisih, transferStokId })
```

---

### TC-TRF-07 — Konfirmasi terima dengan partial receive (barang kurang)

**Role:** `staff_outlet` (Budi, Outlet Sudirman) atau `owner`
**Aksi:** Konfirmasi TRF-001 (kirim 20 kg Tepung) → ubah qty terima menjadi 18 kg (2 kg tumpah)

**Hasil yang diharapkan:**
- Stok Tepung Sudirman bertambah 18, bukan 20
- JurnalStok masuk: qty = 18
- JurnalTransfer dibuat: `{ qtyKirim: 20, qtyTerima: 18, selisih: 2 }`
- Di detail transfer, kolom "Qty Diterima" tampil merah dengan label "Ada penyusutan"

---

### TC-TRF-08 — Staff outlet GAGAL konfirmasi transfer bukan miliknya

**Role:** `staff_outlet` (Budi, lokasiId: l2)
**Aksi:** Coba konfirmasi transfer yang tujuannya adalah l3 (Gajah Mada)

**Hasil yang diharapkan:**
- Frontend: tombol tidak tampil, ada label "Menunggu konfirmasi penerima di lokasi tujuan"
- Backend: HTTP 403

**Backend logic:**
```
POST /api/transfer-stok/:id/terima
Guard: if (req.pengguna.lokasiId !== trf.ke.id && req.pengguna.role !== 'owner') → 403
```

---

### TC-TRF-09 — Batalkan transfer dari status PENDING

**Role:** `admin_gudang`
**Aksi:** Batalkan TRF-002 (Outlet Sudirman → Gudang Pusat, Susu 5L, status PENDING)

**Hasil yang diharapkan:**
- Status berubah `BATAL`
- Stok TIDAK berubah (belum pernah dikurangi karena masih PENDING)
- Toast: "Dokumen transfer berhasil dibatalkan."

**Backend logic:**
```
POST /api/transfer-stok/:id/batal
Auth: authPengguna
Guard: role !== 'staff_outlet'
Validasi: status harus PENDING atau DIKIRIM
if (trf.status === 'PENDING'):
  → hanya update status, tidak ada perubahan stok
if (trf.status === 'DIKIRIM'):
  → ROLLBACK stok ke lokasi asal (lihat TC-TRF-10)
TransferStok.update({ status: "BATAL" })
```

---

### TC-TRF-10 — Batalkan transfer dari status DIKIRIM (rollback stok) ⚠️ Bug Fix

**Role:** `admin_gudang` atau `owner`
**Aksi:** Batalkan transfer yang sudah berstatus DIKIRIM

**Pre-kondisi:** Stok Gudang sudah dikurangi saat DIKIRIM (ini bug yang sudah diperbaiki)

**Hasil yang diharapkan:**
- Status berubah `BATAL`
- Stok di lokasi asal DIKEMBALIKAN sebesar `qtyKirim` per item
- JurnalStok dibuat: `{ tipe: "masuk", sumber: "Pembatalan Transfer" }` untuk mencatat rollback
- Toast: "Transfer dibatalkan. Stok lokasi asal telah dikembalikan."

**Backend logic:**
```
POST /api/transfer-stok/:id/batal
Transaksi atomik (jika status === 'DIKIRIM'):
  1. for each item:
       Inventory.increment({ bahanBakuId, lokasiId: trf.dari.id }, item.qtyKirim)
       JurnalStok.create({ tipe: "masuk", qty: item.qtyKirim, sumber: "Pembatalan Transfer" })
  2. TransferStok.update({ status: "BATAL" })
Note: TIDAK ada JurnalStok jika status masih PENDING sebelum dibatalkan
```

---

## 6. Skenario Lintas Modul (End-to-End)

### E2E-01 — Alur Lengkap: Request Outlet → Transfer → Terima

Ini adalah skenario happy path utama WMS.

```
[staff_outlet: Budi, Outlet Sudirman]
  Step 1: Buat PermintaanStok
    → Kopi Arabica, 8 kg → ke Gudang Pusat
    → Status: PENDING
    → Stok: tidak berubah

[admin_gudang: Zainuddin]
  Step 2: Review di dashboard → "Butuh Persetujuan"
  Step 3: Buka PermintaanStok → cek stok fisik gudang (12 kg, cukup)
  Step 4: Klik "Setujui & Buat Draf Transfer"
    → Status PermintaanStok: DISETUJUI
    → TransferStok baru dibuat: PENDING
    → Stok: belum berubah
  Step 5: Buka TransferStok PENDING tersebut
  Step 6: Klik "Approve & Kirim Barang"
    → Status: DIKIRIM
    → Stok Kopi di Gudang Pusat: 12 → 4
    → JurnalStok: keluar 8 kg (l1)

[staff_outlet: Budi, Outlet Sudirman]
  Step 7: Buka Transfer yang menuju ke lokasinya
  Step 8: Klik "Konfirmasi Diterima" → qty terima = 8 kg (sesuai)
    → Status: DITERIMA
    → Stok Kopi di Outlet Sudirman: 4 → 12
    → JurnalStok: masuk 8 kg (l2)

Verifikasi akhir:
  - PermintaanStok status: DISETUJUI, transferStokId: TRF-xxx
  - TransferStok status: DITERIMA, qtyTerima: 8
  - Inventory Gudang(b4): 4 kg
  - Inventory Sudirman(b4): 12 kg
  - JurnalStok: 2 record (keluar l1, masuk l2)
```

---

### E2E-02 — Alur IBT: Owner approve Transfer Antar-Cabang

```
[owner: Dewi]
  Step 1: Buat draf TransferStok
    → Dari: Outlet Sudirman (l2) → Ke: Outlet Gajah Mada (l3)
    → Tepung Terigu 10 kg
    → Status: PENDING
    → IBT flag: dari.tipe === 'outlet' && ke.tipe === 'outlet' → true

[admin_gudang: Zainuddin]
  Step 2: Buka TransferStok tersebut
  Step 3: Tombol "Approve" diganti badge "Menunggu Approval Owner" ← BENAR

[owner: Dewi]
  Step 4: Buka TransferStok yang sama
  Step 5: Tombol "Approve & Kirim Barang" tampil → klik
    → Stok Tepung Sudirman: 15 → 5
    → Status: DIKIRIM

[staff_outlet: staff Gajah Mada, atau Owner]
  Step 6: Konfirmasi terima
    → Stok Tepung Gajah Mada: 30 → 40
    → Status: DITERIMA
```

---

### E2E-03 — Alur Pembatalan dengan Rollback (Skenario Bug Fix)

```
[admin_gudang]
  Step 1: Buat TransferStok PENDING: Gudang → Outlet, Gula 15 kg
  Step 2: Approve → kirim
    → Status: DIKIRIM
    → Stok Gudang Gula: 85 → 70
  Step 3: Ternyata outlet tidak jadi butuh. Batalkan.
    → Status: BATAL
    → Stok Gudang Gula KEMBALI: 70 → 85 ← KRITIS, harus rollback
    → JurnalStok: masuk 15 (sumber: "Pembatalan Transfer")

Verifikasi: Stok Gudang Gula = 85 (sama seperti sebelum transfer)
```

---

## 7. Matriks Otorisasi API Endpoint

| Endpoint | Method | `owner` | `admin_gudang` | `staff_outlet` |
|---|---|---|---|---|
| `/inventory` | GET | ✅ (all) | ✅ (all) | ✅ (lokasi sendiri) |
| `/inventory/:id/minimum` | PATCH | ✅ | ✅ | ❌ 403 |
| `/inventory/:id/opname` | POST | ✅ | ✅ | ❌ 403 |
| `/permintaan-stok` | GET | ✅ (all) | ✅ (all) | ✅ (outlet sendiri) |
| `/permintaan-stok` | POST | ❌ (owner tidak di outlet) | ❌ | ✅ (outlet sendiri) |
| `/permintaan-stok/:id/setujui` | POST | ✅ | ✅ | ❌ 403 |
| `/permintaan-stok/:id/tolak` | POST | ✅ | ✅ | ❌ 403 |
| `/transfer-stok` | GET | ✅ (all) | ✅ (all) | ✅ (libat lokasi sendiri) |
| `/transfer-stok` | POST (non-IBT) | ✅ | ✅ | ❌ 403 |
| `/transfer-stok` | POST (IBT) | ✅ | ❌ 403 | ❌ 403 |
| `/transfer-stok/:id/kirim` | POST (non-IBT) | ✅ | ✅ | ❌ 403 |
| `/transfer-stok/:id/kirim` | POST (IBT) | ✅ | ❌ 403 | ❌ 403 |
| `/transfer-stok/:id/terima` | POST | ✅ | ✅ | ✅ (ke.id === lokasiId) |
| `/transfer-stok/:id/batal` | POST | ✅ | ✅ | ❌ 403 |

---

## 8. Logika Backend: State Machine & Business Rules

### State Machine TransferStok

```
                 ┌─────────┐
   POST /kirim   │         │   POST /kirim (IBT, owner only)
   (admin/owner) │ PENDING │──────────────────────────────────┐
                 │         │                                  │
                 └────┬────┘                                  │
                      │ stok lokasi asal berkurang            │
                      ▼                                       ▼
                 ┌─────────┐                           ┌─────────────┐
                 │ DIKIRIM │                           │   DIKIRIM   │
                 │(normal) │                           │    (IBT)    │
                 └────┬────┘                           └──────┬──────┘
                      │ POST /terima                          │
                      │ (staff ke.id / owner)                 │
                      ▼                                       ▼
                 ┌──────────┐                         ┌──────────────┐
                 │ DITERIMA │                         │   DITERIMA   │
                 └──────────┘                         └──────────────┘

  Dari PENDING  → BATAL: tidak ada perubahan stok
  Dari DIKIRIM  → BATAL: ROLLBACK stok ke lokasi asal ⚠️
```

### State Machine PermintaanStok

```
                 ┌─────────┐
    (staff buat) │         │
                 │ PENDING │
                 │         │
                 └────┬────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
    POST /setujui           POST /tolak
    (admin/owner)           (admin/owner)
          │                       │
          ▼                       ▼
    ┌──────────┐            ┌─────────┐
    │DISETUJUI │            │ DITOLAK │
    │+ buat TRF│            │         │
    └──────────┘            └─────────┘
```

### Aturan Bisnis Kritis

**Stok tidak boleh negatif:**
Semua operasi pengurangan stok (`/kirim`) wajib re-validasi stok terkini saat eksekusi,
bukan hanya saat draf dibuat. Gunakan MongoDB findOneAndUpdate dengan kondisi:
```js
{ bahanBakuId, lokasiId, stok: { $gte: qtyKirim } }
```
Jika tidak ada dokumen yang match, artinya stok tidak cukup → rollback seluruh transaksi.

**Atomicity untuk multi-item transfer:**
Jika transfer berisi 3 item dan item ke-2 gagal (stok tidak cukup), seluruh
operasi `/kirim` harus dibatalkan — item pertama yang sudah berkurang harus di-rollback.
Gunakan MongoDB session + transaction.

**Rollback saat BATAL dari DIKIRIM:**
Saat transfer dibatalkan dari status DIKIRIM, stok harus dikembalikan PERSIS sebesar
`qtyKirim` (bukan `qtyTerima` karena barang belum sampai). Harus ada JurnalStok
bertipe `"masuk"` dengan `sumber: "Pembatalan Transfer"` untuk audit trail.

**Partial receive:**
Saat `/terima`, `qtyTerima` bisa lebih kecil dari `qtyKirim`. Stok outlet bertambah
sebesar `qtyTerima`. Selisih dicatat di JurnalTransfer. Gudang tidak mendapat stok
kembali secara otomatis — jika perlu, buat TransferStok retur terpisah.

**IBT double-check:**
Cek tipe IBT dilakukan di DUA tempat:
1. `POST /transfer-stok` — saat pembuatan draf (cegah admin_gudang buat IBT)
2. `POST /transfer-stok/:id/kirim` — saat approval (cegah admin_gudang approve IBT)
Kedua guard harus ada karena status bisa berubah setelah draf dibuat.

**outletId spoof protection:**
Saat staff_outlet POST ke `/permintaan-stok`, `outletId` di body harus divalidasi
sama dengan `req.pengguna.lokasiId` dari JWT. Jangan percaya body request mentah.
```js
if (req.body.outletId !== req.pengguna.lokasiId) throw new Error(403)
```

### JurnalStok — Kapan Dibuat

| Event | Tipe | Lokasi | Qty | Sumber |
|---|---|---|---|---|
| Transfer status → DIKIRIM | `keluar` | `trf.dari` | `qtyKirim` | `"Transfer"` |
| Transfer status → DITERIMA | `masuk` | `trf.ke` | `qtyTerima` | `"Transfer"` |
| Transfer status → BATAL (dari DIKIRIM) | `masuk` | `trf.dari` | `qtyKirim` | `"Pembatalan Transfer"` |
| Opname (koreksi stok fisik) | `koreksi` | lokasi item | `delta (±)` | `"Opname"` |
| Pembelian stok dari supplier | `masuk` | gudang tujuan | `qtyBeli` | `"Pembelian"` |
| Penjualan FINAL (via resep produk) | `keluar` | outlet POS | sesuai resep | `"Penjualan"` |

---

*Dokumen ini dibuat berdasarkan `page.tsx` versi yang telah diperbaiki (Bug #1–#4).*
*Versi: 1.0 — 30 Maret 2024*
