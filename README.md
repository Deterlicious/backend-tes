# 🏪 Backend POS Multi-Tenant — Node.js REST API

Backend REST API untuk sistem **Point of Sale (POS) multi-tenant** berbasis Node.js, Express, MongoDB (Mongoose), dan Redis. Dirancang untuk mendukung bisnis warung/restoran/kafe dengan fitur lengkap mulai dari manajemen transaksi penjualan, inventaris stok, booking sesi aset, keanggotaan pelanggan, hingga laporan keuangan harian & bulanan.

---

## 📋 Daftar Isi

- [Tech Stack](#-tech-stack)
- [Struktur Proyek](#-struktur-proyek)
- [Arsitektur & Konsep Multi-Tenant](#-arsitektur--konsep-multi-tenant)
- [Sistem Autentikasi](#-sistem-autentikasi)
- [Struktur Database & Relasi](#-struktur-database--relasi)
- [Daftar API Endpoint](#-daftar-api-endpoint)
- [Logika Bisnis Utama](#-logika-bisnis-utama)
- [Konfigurasi & Menjalankan Proyek](#-konfigurasi--menjalankan-proyek)

---

## 🛠 Tech Stack

| Teknologi | Versi | Keterangan |
|---|---|---|
| **Node.js** | — | Runtime JavaScript |
| **Express.js** | ^5.1.0 | Web framework |
| **MongoDB** | — | Database utama (NoSQL) |
| **Mongoose** | ^8.19.2 | ODM untuk MongoDB |
| **Redis / ioredis** | ^5.8.2 | Cache & session store |
| **JWT (jsonwebtoken)** | ^9.0.2 | Autentikasi berbasis token |
| **bcrypt** | ^6.0.0 | Hashing password & PIN |
| **Joi** | ^18.0.2 | Validasi input request |
| **Helmet** | ^8.1.0 | Security HTTP headers |
| **CORS** | ^2.8.5 | Cross-Origin Resource Sharing |
| **dotenv** | ^17.2.3 | Manajemen environment variables |
| **Nodemon** | ^3.1.10 | Auto-restart saat development |

---

## 📁 Struktur Proyek

```
backend-js/
├── app.js                  # Konfigurasi Express, middleware global, routing
├── serverNew.js            # Entry point: connect DB & start server
├── config/
│   ├── index.js            # Konfigurasi PORT, HOST, MONGO_URI, REDIS_URL
│   ├── database.js         # Koneksi MongoDB
│   └── redis.js            # Koneksi Redis
├── models/                 # 38 Mongoose Schema (definisi koleksi DB)
├── controllers/            # 38 Controller (handler request & response)
├── services/               # 40 Service (logika bisnis inti)
├── routes/
│   ├── index.js            # Auto-loader: scan & mount semua file route
│   └── *.js                # 38 file route individual
├── middleware/
│   ├── authAkun.js         # JWT auth untuk Akun (Owner/Admin SaaS)
│   ├── authPengguna.js     # JWT auth untuk Pengguna (Staff/Kasir)
│   ├── authorize.js        # Guard role (adminOnly)
│   ├── authorizePermission.js # Guard permission granular (kelola-staff, dll)
│   └── errorHandler.js     # Centralized error handler
├── validators/             # 38 Validator Joi per resource
├── utils/                  # Logger & utilities
├── seeds/                  # Script seed data awal
└── .env.example            # Template environment variables
```

> **Auto-loader Route**: `routes/index.js` secara otomatis membaca semua file `*.js` di folder `routes/`, mengubah nama file menjadi mount path (contoh: `penjualanRoute.js` → `/api/penjualan`), dan meregisternya ke Express.

---

## 🏗 Arsitektur & Konsep Multi-Tenant

Setiap **Tenant** merepresentasikan satu toko/outlet. Semua data (produk, pengguna, transaksi, dsb.) terisolasi per tenant menggunakan field `tenantID` di setiap koleksi. Tidak ada data yang bocor antar tenant.

```
[SaaS Platform]
       │
       ├── Tenant A (Kafe Mawar) ── Produk, Stok, Penjualan, Karyawan, ...
       ├── Tenant B (Warung Bu Sari) ── Produk, Stok, Penjualan, Karyawan, ...
       └── Tenant C (...)
```

**Dua level pengguna:**

| Level | Model | Autentikasi | Deskripsi |
|---|---|---|---|
| **Akun** | `akunModel` | Email + Password + JWT | Pemilik toko (Owner/Admin SaaS). Mengelola tenant & konfigurasi. |
| **Pengguna** | `penggunaModel` | PIN + JWT | Staff/Kasir di dalam toko. Login via PIN di layar kasir. |

---

## 🔐 Sistem Autentikasi

### Dual JWT System

Terdapat **dua token JWT yang berbeda** dengan secret terpisah:

#### 1. `authAkun` — untuk Owner/Admin
- **Secret**: `AKUN_JWT_SECRET`
- Dipakai untuk mengelola tenant, konfigurasi toko, dan manajemen device.
- Mendukung **multi-device login** dengan validasi `deviceID` dan `tokenVersion` per perangkat.
- Jika token versi tidak cocok, sesi dianggap hangus (forced logout / revoke).
- Middleware menyimpan konteks di `req.akunContext` (`akunID`, `roleAkun`, `tenantID`, `roleID`).

#### 2. `authPengguna` — untuk Staff/Kasir
- **Secret**: `PENGGUNA_JWT_SECRET`
- Dipakai untuk semua operasi kasir (penjualan, pembayaran, booking, dll).
- Validasi `tokenVersion` di level pengguna (logout paksa).
- Middleware menyimpan konteks di `req.pengguna` (termasuk `permissions` yang di-populate dari Role).

### RBAC (Role-Based Access Control)

```
Role (per tenant) ──── permissions[] → [Permission]
      │
   Pengguna (Staff) ── roleID → Role
```

- Setiap **Role** memiliki daftar `permissions` (array ObjectId→Permission).
- Middleware `authorizePermission.checkPermission("nama-permission")` memblokir request jika staff tidak punya izin.
- **Akun** (Owner) memiliki akses bypass — tidak perlu cek permission individual.

Contoh permission yang digunakan: `kelola-staff`, dll.

---

## 🗄 Struktur Database & Relasi

### Kelompok: Tenant & Akun (Fondasi SaaS)

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Tenant` | `tenants` | Data toko: nama, alamat, konfigurasi pajak, status setup |
| `Akun` | `akuns` | Akun owner/admin, email+password, device list, linked tenant |

**Field konfigurasi Tenant:**
- `persenPajak` — persentase pajak default toko
- `tipePajak` — `"Sudah Termasuk (Inclusive)"` / `"Belum Termasuk (Exclusive)"`
- `isSetupComplete` — flag apakah setup awal sudah selesai
- `footerStruk`, `logoUrl` — branding struk cetak

### Kelompok: IAM (Identity & Access Management)

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Pengguna` | `penggunas` | Staff/Kasir: nama, PIN (hashed bcrypt), roleID, posisiID, tenantID |
| `Role` | `roles` | Nama role (e.g. Kasir, Manager), daftar permissions |
| `Permission` | `permissions` | Master daftar izin per aksi (e.g. kelola-staff) |
| `RolePermission` | `rolepermissions` | Join table role ↔ permission |
| `Posisi` | `posisis` | Jabatan/posisi karyawan (e.g. Barista, Supervisor) |

### Kelompok: Master Data Produk

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Produk` | `produks` | Produk: nama, harga dasar, harga jual, stok, kategori, resep, pajak |
| `Kategori` | `kategoris` | Kategori produk per tenant |
| `BahanBaku` | `bahanbakus` | Inventaris bahan baku (nama, satuan) |

**Resep Produk (Embedded)**:
```
Produk.resep[] = [{ bahanBakuID, jumlah, satuan }]
```
Satu produk bisa memiliki banyak bahan baku. Saat produk terjual, resep dipakai untuk menghitung HPP dan mengurangi stok bahan baku.

### Kelompok: Transaksi Penjualan

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Penjualan` | `penjualans` | Transaksi penjualan utama (header) |
| `Pembayaran` | `pembayarans` | Record pembayaran per transaksi |
| `Diskon` | `diskons` | Master diskon (global/per item, persen/nominal) |
| `Pajak` | `pajaks` | Master pajak (per produk / per transaksi, inclusive/exclusive) |
| `ProdukPajak` | `produkpajaks` | Mapping produk ↔ pajak |
| `MetodePembayaran` | `metodepembayarans` | Metode bayar (cash, QRIS, transfer, dll) |
| `AkunKas` | `akunkass` | Akun kas/rekening untuk mencatat arus kas |

**Relasi Penjualan:**
```
Penjualan
 ├── tenantID → Tenant
 ├── penggunaID → Pengguna (kasir)
 ├── pelangganID → Pelanggan
 ├── itemPenjualan[] (embedded)
 │    ├── produkID → Produk
 │    ├── diskonItemIDs[] → Diskon
 │    └── rincianPajak[]
 ├── diskonGlobalIDs[] → Diskon
 └── pajakTransaksiIDs[] → Pajak

Pembayaran
 ├── penjualanID → Penjualan
 ├── akunKasID → AkunKas
 └── metodePembayaranID → MetodePembayaran
```

**Status Penjualan:** `DRAFT` → `FINAL`

**Status Bayar:** `UNPAID` → `PARTIAL` → `PAID` *(dihitung otomatis oleh Mongoose pre-validate hook)*

**Jenis Transaksi:** `POS` | `INVOICE`

**Jenis Penjualan:** `dine-in` | `takeaway` | `booking`

### Kelompok: Pelanggan & Membership

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Pelanggan` | `pelanggans` | Data pelanggan toko |
| `PaketMembership` | `paketmemberships` | Paket membership (durasi, harga, benefit) |
| `Membership` | `memberships` | Record aktifasi membership pelanggan |

**Relasi Membership:**
```
Membership
 ├── pelangganID → Pelanggan
 ├── paketMembershipID → PaketMembership
 └── penjualanID → Penjualan (transaksi pembelian paket)
```

### Kelompok: Booking Sesi Aset

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Aset` | `asets` | Aset toko yang bisa di-booking (meja, ruangan, PS, dll) |
| `TipeAset` | `tipeasets` | Tipe/kategori aset |
| `Tarif` | `tarifs` | Tarif billing aset (per jam, per sesi) |
| `SesiBooking` | `sesibookings` | Record sesi booking aset oleh pelanggan |

**Relasi SesiBooking:**
```
SesiBooking
 ├── tenantID → Tenant
 ├── dataPengguna → Pengguna (kasir yg buka sesi)
 ├── dataPelanggan → Pelanggan
 ├── dataAset → Aset
 ├── dataPenjualan → Penjualan
 └── dataTarif → Tarif
```

**Status SesiBooking:** `Aktif` → `Selesai` | `Batal`

Durasi sesi dihitung otomatis via Mongoose pre-save hook:
```js
durasiMenit = ceil((waktuSelesai - waktuMulai) / 60000)
```

### Kelompok: Inventaris & Gudang

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Inventory` | `inventories` | Stok bahan baku per lokasi (gudang/outlet) |
| `Location` | `locations` | Master lokasi fisik (gudang pusat, outlet A, dll) |
| `TransferStok` | `transferstoks` | Dokumen transfer bahan baku antar lokasi |
| `PembelianStok` | `pembelianstoks` | Pembelian stok bahan baku dari supplier |
| `PermintaanStok` | `permintaanstoks` | Request pengiriman stok dari outlet ke gudang |
| `JurnalStok` | `jurnalstoks` | Log mutasi stok (masuk/keluar/koreksi) |
| `JurnalTransfer` | `jurnaltransfers` | Log detail setiap perpindahan stok |

**Konsep WMS (Warehouse Management System):**
```
Location (Gudang Pusat) ──TransferStok──► Location (Outlet)
       │                                         │
  Inventory.stok                          Inventory.stok
  (berkurang saat DIKIRIM)              (bertambah saat DITERIMA)
```

Status TransferStok: `PENDING` → `DIKIRIM` → `DITERIMA` | `BATAL`

### Kelompok: Keuangan & Laporan

| Model | Koleksi | Deskripsi |
|---|---|---|
| `BebanOperasional` | `bebanoperasionals` | Pencatatan biaya operasional (sewa, listrik, dll) |
| `KategoriBeban` | `kategoriebans` | Kategori jenis beban operasional |
| `LaporanHarian` | `laporanharins` | Rekap laporan keuangan harian per tenant |
| `LaporanBulanan` | `laporanbulanan` | Rekap laporan keuangan bulanan per tenant |

**Perhitungan Laporan Harian:**
```
totalPenjualanKotor - totalDiskon = totalOmzet
totalOmzet - totalHPP            = totalLabaKotor
totalLabaKotor - totalBeban      = totalLabaBersih  ← KPI Utama
```

### Kelompok: SDM (Human Resource)

| Model | Koleksi | Deskripsi |
|---|---|---|
| `Absensi` | `absensis` | Rekam kehadiran karyawan (waktu masuk, pulang, foto) |
| `IzinCuti` | `izincutis` | Pengajuan izin/cuti karyawan |
| `KontrakKompensasi` | `kontrakkompensasis` | Kontrak gaji/kompensasi karyawan per periode |

Durasi kerja pada Absensi dihitung otomatis:
```js
durasiKerja = (waktuPulang - waktuMasuk) / 3600000  // dalam jam
```

---

## 🌐 Daftar API Endpoint

Semua endpoint berada di bawah prefix `/api`. Route di-mount otomatis dari nama file:

### Auth & Akun (Owner)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/akun/auth/register` | Public | Registrasi akun owner baru |
| POST | `/api/akun/auth/login` | Public | Login owner, mendapat access token |
| POST | `/api/akun/auth/refreshtoken` | Public | Refresh JWT access token |
| POST | `/api/akun/auth/logout` | Public | Logout |
| GET | `/api/akun/auth/akun` | authAkun | Lihat profil akun sendiri |
| PUT | `/api/akun/auth/akun` | authAkun | Update profil akun |
| GET | `/api/akun/admin/all` | authAkun + adminOnly | Lihat semua akun (admin SaaS) |
| DELETE | `/api/akun/admin/users/:id` | authAkun + adminOnly | Hapus akun (admin SaaS) |
| GET | `/api/akun/device` | authAkun | Lihat daftar device terdaftar |
| POST | `/api/akun/device/add` | authAkun | Tambah device baru |
| PUT | `/api/akun/device/promote` | authAkun | Promosikan device ke primary |
| PUT | `/api/akun/device/demote` | authAkun | Demote device ke secondary |
| DELETE | `/api/akun/device/remove` | authAkun | Hapus device |
| GET | `/api/akun/devicehistory` | authAkun | Riwayat perubahan device |

### Auth Pengguna (Staff/Kasir)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/pengguna/pin-refresh` | Public | Refresh token pengguna |
| POST | `/api/pengguna/pin-login` | authAkun | Login PIN kasir di toko |
| POST | `/api/pengguna/pin-logout` | authAkun | Logout kasir |
| POST | `/api/pengguna/register-owner` | authAkun | Buat akun pengguna pertama (owner) |
| GET | `/api/pengguna/login-list/:tenantID` | authAkun | Daftar karyawan untuk layar login PIN |
| POST | `/api/pengguna/register-staff` | authAkun + perm | Tambah staff baru |
| GET | `/api/pengguna/staff` | authAkun + perm | Daftar semua staff |
| GET | `/api/pengguna/staff/:id` | authAkun + perm | Detail staff |
| PUT | `/api/pengguna/staff/:id` | authAkun + perm | Update data staff |
| DELETE | `/api/pengguna/staff/:id` | authAkun + perm | Hapus staff |

> **perm** = membutuhkan permission `kelola-staff`

### Produk & Kategori
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/produk` | authPengguna | List semua / Buat produk baru |
| GET/PUT/DELETE | `/api/produk/:id` | authPengguna | Detail / Update / Hapus produk |
| GET/POST | `/api/kategori` | authPengguna | List / Buat kategori |
| GET/PUT/DELETE | `/api/kategori/:id` | authPengguna | Detail / Update / Hapus kategori |

### Penjualan & Pembayaran
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/penjualan` | authPengguna | List transaksi / Buat transaksi baru |
| GET/PUT/DELETE | `/api/penjualan/:id` | authPengguna | Detail / Update / Hapus transaksi |
| GET/POST | `/api/pembayaran` | authPengguna | List / Buat record pembayaran |
| GET/PUT/DELETE | `/api/pembayaran/:id` | authPengguna | Detail / Update / Hapus pembayaran |

### Pajak & Diskon
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/pajak` | authPengguna | List / Buat pajak |
| GET/PUT/DELETE | `/api/pajak/:id` | authPengguna | Detail / Update / Hapus pajak |
| POST | `/api/pajak/simulasi-produk` | authPengguna | Simulasi kalkulasi pajak per produk |
| POST | `/api/pajak/simulasi-transaksi` | authPengguna | Simulasi kalkulasi pajak per transaksi |
| GET/POST | `/api/diskon` | authPengguna | List / Buat diskon |
| GET/PUT/DELETE | `/api/diskon/:id` | authPengguna | Detail / Update / Hapus diskon |

### Booking Aset
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/sesibooking` | authPengguna | List sesi / Buka sesi booking baru |
| GET/PUT/DELETE | `/api/sesibooking/:id` | authPengguna | Detail / Update / Tutup sesi |
| GET/POST | `/api/aset` | authPengguna | List / Tambah aset |
| GET/POST | `/api/tarif` | authPengguna | List / Tambah tarif |

### Inventaris & Stok
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/inventory` | authPengguna | List stok / Tambah stok |
| GET/POST | `/api/transferstok` | authPengguna | List / Buat dokumen transfer |
| GET/POST | `/api/pembelianstok` | authPengguna | List / Catat pembelian stok |
| GET/POST | `/api/permintaanstok` | authPengguna | List / Buat permintaan stok |
| GET/POST | `/api/jurnalstok` | authPengguna | Log mutasi stok |
| GET/POST | `/api/bahanbaku` | authPengguna | List / Tambah bahan baku |

### Pelanggan & Membership
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/pelanggan` | authPengguna | List / Tambah pelanggan |
| GET/PUT/DELETE | `/api/pelanggan/:id` | authPengguna | Detail / Update / Hapus pelanggan |
| GET/POST | `/api/membership` | authPengguna | List / Aktivasi membership |
| GET/POST | `/api/paketmembership` | authPengguna | List / Tambah paket |

### Laporan & Keuangan
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/laporanharian` | authPengguna | Laporan keuangan harian |
| GET | `/api/laporanbulanan` | authPengguna | Laporan keuangan bulanan |
| GET/POST | `/api/bebanoperasional` | authPengguna | List / Catat beban operasional |
| GET/POST | `/api/akunkass` | authPengguna | List akun kas |

### SDM & HR
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/absensi` | authPengguna | List / Catat absensi karyawan |
| GET/POST | `/api/izincuti` | authPengguna | List / Ajukan izin/cuti |
| GET/POST | `/api/kontrakkompensasi` | authPengguna | List / Buat kontrak kompensasi |

### Role & Permission
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET/POST | `/api/role` | authAkun | List / Buat role |
| GET/PUT/DELETE | `/api/role/:id` | authAkun | Detail / Update / Hapus role |
| GET/POST | `/api/permission` | authAkun | List / Buat permission |
| GET/POST | `/api/rolepermission` | authAkun | Kelola mapping role ↔ permission |

### Health Check
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/healthz` | Public | Status server (untuk load balancer) |
| GET | `/ready` | Public | Kesiapan server |
| GET | `/api/` | Public | Konfirmasi API aktif |

---

## ⚙️ Logika Bisnis Utama

### 1. Perhitungan Harga Penjualan (Auto Pre-Validate Hook)

```
Untuk setiap item:
  subTotal     = jumlah × hargaJual
  jumlahDiskon = diskon yang berlaku
  total        = subTotal - jumlahDiskon
  jumlahPajak  = pajak yang berlaku
  totalharga   = total + jumlahPajak

Agregasi transaksi:
  totalHargaProduk   = SUM(item.totalharga)
  totalTagihan       = totalHargaProduk - diskonGlobal + pajakTransaksi
  sisaTagihan        = totalTagihan - totalDibayar

Status Bayar (otomatis):
  totalTagihan == 0 || sisaTagihan == 0  → "PAID"
  dibayar > 0 && sisaTagihan > 0         → "PARTIAL"
  else                                   → "UNPAID"
```

### 2. Diskon — Dua Jenis Cakupan

| Cakupan | Tipe | Keterangan |
|---|---|---|
| `Item` | `persen` / `nominal` | Berlaku untuk satu item produk tertentu |
| `Global` | `persen` / `nominal` | Berlaku untuk total transaksi keseluruhan |

Flag `bisaDigabung`: jika `false`, diskon tidak bisa dikombinasikan dengan diskon lain.

### 3. Pajak — Model Perhitungan

| `modelPerhitungan` | Tipe | Keterangan |
|---|---|---|
| `1` | — | Model perhitungan pertama |
| `2` | — | Model perhitungan kedua |
| `3` | — | Model perhitungan ketiga |

- `tipePajak = true` → Per Produk; `false` → Per Transaksi
- `prioritas`: `1` (utama) atau `2` (lapis kedua, compound tax)
- `akunPajakID` → terhubung ke AkunKas untuk pencatatan akuntansi

### 4. Transfer Stok (WMS Flow)

```
1. Buat TransferStok [PENDING]
2. Kirim → status menjadi [DIKIRIM], stok Gudang berkurang
3. Terima → status menjadi [DITERIMA], stok Outlet bertambah sesuai qtyTerima
   (qtyTerima bisa < qtyKirim jika ada barang rusak/hilang)
```

### 5. Booking Sesi Aset

```
1. Buka sesi: SesiBooking dibuat [Aktif], linked ke Penjualan
2. Durasi dihitung otomatis saat waktuSelesai diset
3. Tutup sesi: status → [Selesai], totalBiaya dihitung dari Tarif
4. Pembayaran diproses melalui alur Penjualan biasa
```

### 6. Autentikasi Device (Akun Multi-Device)

```
Akun bisa punya beberapa device (max berdasarkan maxDevice & maxPrimaryDevice).
Setiap device punya:
  - deviceID: identifier unik perangkat
  - type: "primary" | "secondary"
  - tokenVersion: versi token (increment saat logout/revoke)
  - lastUsed: timestamp terakhir dipakai

Saat login: tokenVersion disertakan di payload JWT.
Saat validasi: tokenVersion di DB harus cocok dengan token.
Jika tidak cocok → sesi ditolak (forced logout).
```

---

## 🚀 Konfigurasi & Menjalankan Proyek

### Prasyarat

- Node.js (LTS)
- MongoDB (running lokal atau URI Atlas)
- Redis (opsional, untuk caching)

### Instalasi

```bash
git clone <repo-url>
cd backend-js
npm install
```

### Konfigurasi Environment

Salin `.env.example` ke `.env` dan isi nilainya:

```env
# JWT Secrets
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
AKUN_JWT_SECRET=your_akun_jwt_secret_here
PENGGUNA_JWT_SECRET=your_pengguna_jwt_secret_here

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/db_produk

# Redis (opsional)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Server
PORT=4000
HOST=127.0.0.1
NODE_ENV=development
```

### Menjalankan Server

```bash
# Development (auto-restart dengan nodemon)
npm start

# Server akan berjalan di http://127.0.0.1:4000
```

### Health Check

```bash
curl http://localhost:4000/healthz
# {"status":"ok"}

curl http://localhost:4000/api
# {"message":"API is running"}
```

---

## 📌 Catatan Pengembang

- Semua timestamp menggunakan `{ timestamps: true }` Mongoose (otomatis `createdAt` & `updatedAt`).
- Compound index digunakan di hampir semua koleksi untuk isolasi data antar tenant dan performa query.
- Error handling terpusat di `middleware/errorHandler.js` — menangani Mongoose ValidationError, duplicate key (E11000), JWT error, dan CastError.
- Validator request menggunakan **Joi** di folder `validators/` — setiap resource memiliki validator terpisah.
- Pattern route: `router.route("/").get().post()` dan `router.route("/:id").get().put().delete()` digunakan secara konsisten.
