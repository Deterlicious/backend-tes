# 📬 Panduan Pengujian Postman — Modul Kategori, Pajak & Produk

Dokumen ini berisi panduan lengkap untuk menguji tiga modul utama dari API ini menggunakan Postman, mulai dari autentikasi hingga pengujian seluruh operasi CRUD dan fitur simulasi pajak.

---

## ⚙️ Setup Awal

### Base URL
```
http://localhost:3000/api
```

### Header Wajib (Semua Request Terautentikasi)
| Key | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {{pengguna_token}}` |

### Cara Simpan Token Otomatis di Postman
Di tab **Tests** pada request login, tambahkan script berikut:
```javascript
const json = pm.response.json();
pm.collectionVariables.set("pengguna_token", json.token);
pm.collectionVariables.set("tenant_id", json.pengguna?.tenantID || "");
```
Lalu ganti header `Authorization` di seluruh collection menjadi: `Bearer {{pengguna_token}}`

---

## 🔐 TAHAP 0 — Autentikasi (Prasyarat)

Sebelum menguji modul manapun, Anda harus login terlebih dahulu untuk mendapatkan token JWT.

### Request: Login Pengguna
- **Method:** `POST`
- **URL:** `{{base_url}}/pengguna/pin-login`
- **Auth:** Diperlukan Akun Token (dari `/akun/auth/login`). Lihat catatan di bawah.

> **Catatan Alur Login 2 Tahap:**
> Sistem ini menggunakan dua lapis autentikasi:
> 1. **Login Akun** → Mendapat `akun_token` (via `/akun/auth/login`)
> 2. **Login Pengguna (PIN)** → Mendapat `pengguna_token` (via `/pengguna/pin-login`, menggunakan `akun_token` di header)

### Langkah 0.1 — Login Akun
- **Method:** `POST`
- **URL:** `{{base_url}}/akun/auth/login`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "email": "owner@example.com",
  "password": "password123"
}
```
- **Response Sukses (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Login berhasil"
}
```
> Simpan nilai `token` sebagai `{{akun_token}}` di Postman Variables.

### Langkah 0.2 — Login Pengguna (PIN)
- **Method:** `POST`
- **URL:** `{{base_url}}/pengguna/pin-login`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{akun_token}}`
- **Body (raw JSON):**
```json
{
  "pin": "123456"
}
```
- **Response Sukses (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "pengguna": {
    "_id": "60d5ecb8b89c2a001c8b4567",
    "nama": "Admin Owner",
    "tenantID": "60d5ecb8b89c2a001c8b1234",
    "roleID": {
      "namaRole": "Owner",
      "permissions": [...]
    }
  }
}
```
> Simpan `token` sebagai `{{pengguna_token}}` dan `pengguna.tenantID` sebagai `{{tenant_id}}`.

---

## 📂 MODUL 1 — KATEGORI

**Base URL Modul:** `{{base_url}}/kategori`

> **Permission yang Dibutuhkan:** `kelola-kategori`

Kategori digunakan untuk mengelompokkan produk. Setiap kategori memiliki nama dan kode yang unik per tenant.

### Schema Data Kategori
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `namaKategori` | String | ✅ Ya | Nama kategori (min. 2 karakter, unik per tenant) |
| `kodeKategori` | String | ✅ Ya | Kode singkat kategori (unik per tenant) |
| `keterangan` | String | ❌ Tidak | Deskripsi tambahan (opsional) |

---

### 1.1 — Create Kategori
- **Method:** `POST`
- **URL:** `{{base_url}}/kategori`
- **Headers:** _(Gunakan header standar)_
- **Body (raw JSON):**
```json
{
  "namaKategori": "Minuman",
  "kodeKategori": "MNM",
  "keterangan": "Semua jenis minuman yang dijual"
}
```
- **Response Sukses (201):**
```json
{
  "data": {
    "_id": "60d5ecb8b89c2a001c8b5001",
    "namaKategori": "Minuman",
    "kodeKategori": "MNM",
    "keterangan": "Semua jenis minuman yang dijual",
    "tenantID": "60d5ecb8b89c2a001c8b1234",
    "createdAt": "2026-05-24T15:00:00.000Z",
    "updatedAt": "2026-05-24T15:00:00.000Z"
  },
  "message": "Kategori berhasil dibuat"
}
```
> 💡 Simpan `data._id` sebagai `{{kategori_id}}` untuk digunakan di langkah selanjutnya.

**Test Script (tab Tests):**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Kategori berhasil dibuat", () => {
    const json = pm.response.json();
    pm.expect(json.data).to.have.property("_id");
    pm.collectionVariables.set("kategori_id", json.data._id);
});
```

---

**Test Data Tambahan — Buat 2 kategori lagi untuk pengujian produk:**

**Kategori 2:**
```json
{
  "namaKategori": "Makanan",
  "kodeKategori": "MKN",
  "keterangan": "Semua jenis makanan yang dijual"
}
```

**Kategori 3:**
```json
{
  "namaKategori": "Snack",
  "kodeKategori": "SNK",
  "keterangan": "Camilan dan makanan ringan"
}
```

---

### 1.2 — Get All Kategori
- **Method:** `GET`
- **URL:** `{{base_url}}/kategori`
- **Headers:** _(Gunakan header standar)_
- **Body:** _(Tidak ada)_
- **Response Sukses (200):**
```json
{
  "data": [
    {
      "_id": "60d5ecb8b89c2a001c8b5001",
      "namaKategori": "Minuman",
      "kodeKategori": "MNM",
      "keterangan": "Semua jenis minuman yang dijual",
      "tenantID": "60d5ecb8b89c2a001c8b1234",
      "createdAt": "2026-05-24T15:00:00.000Z",
      "updatedAt": "2026-05-24T15:00:00.000Z"
    },
    {
      "_id": "60d5ecb8b89c2a001c8b5002",
      "namaKategori": "Makanan",
      "kodeKategori": "MKN",
      "keterangan": "Semua jenis makanan yang dijual",
      "tenantID": "60d5ecb8b89c2a001c8b1234",
      "createdAt": "2026-05-24T15:00:00.000Z",
      "updatedAt": "2026-05-24T15:00:00.000Z"
    }
  ]
}
```

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Response berisi array", () => {
    const json = pm.response.json();
    pm.expect(json.data).to.be.an("array");
    pm.expect(json.data.length).to.be.greaterThan(0);
});
```

---

### 1.3 — Get Kategori by ID
- **Method:** `GET`
- **URL:** `{{base_url}}/kategori/{{kategori_id}}`
- **Headers:** _(Gunakan header standar)_
- **Body:** _(Tidak ada)_
- **Response Sukses (200):**
```json
{
  "data": {
    "_id": "60d5ecb8b89c2a001c8b5001",
    "namaKategori": "Minuman",
    "kodeKategori": "MNM",
    "keterangan": "Semua jenis minuman yang dijual",
    "tenantID": "60d5ecb8b89c2a001c8b1234"
  }
}
```

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("ID sesuai", () => {
    const json = pm.response.json();
    pm.expect(json.data._id).to.equal(pm.collectionVariables.get("kategori_id"));
});
```

---

### 1.4 — Update Kategori
- **Method:** `PUT`
- **URL:** `{{base_url}}/kategori/{{kategori_id}}`
- **Headers:** _(Gunakan header standar)_
- **Body (raw JSON):**
```json
{
  "namaKategori": "Minuman Segar",
  "keterangan": "Minuman segar dingin dan hangat"
}
```
- **Response Sukses (200):**
```json
{
  "data": {
    "_id": "60d5ecb8b89c2a001c8b5001",
    "namaKategori": "Minuman Segar",
    "kodeKategori": "MNM",
    "keterangan": "Minuman segar dingin dan hangat",
    "tenantID": "60d5ecb8b89c2a001c8b1234",
    "updatedAt": "2026-05-24T16:00:00.000Z"
  },
  "message": "Kategori berhasil diperbarui"
}
```

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Kategori berhasil diperbarui", () => {
    const json = pm.response.json();
    pm.expect(json.data.namaKategori).to.equal("Minuman Segar");
});
```

---

### 1.5 — Delete Kategori

> ⚠️ **PERHATIAN:** Jalankan langkah ini TERAKHIR setelah selesai menguji Produk, karena Produk membutuhkan `kategoriID`.

- **Method:** `DELETE`
- **URL:** `{{base_url}}/kategori/{{kategori_id}}`
- **Headers:** _(Gunakan header standar)_
- **Body:** _(Tidak ada)_
- **Response Sukses (200):**
```json
{
  "message": "Kategori berhasil dihapus"
}
```

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Pesan konfirmasi ada", () => {
    const json = pm.response.json();
    pm.expect(json.message).to.include("berhasil dihapus");
});
```

---

### ❌ Skenario Error Kategori

**a) Buat kategori tanpa `namaKategori` (400 Bad Request):**
```json
{
  "kodeKategori": "TEST"
}
```
Expected Response:
```json
{
  "errors": ["namaKategori wajib diisi"]
}
```

**b) Buat kategori dengan nama duplikat (400 / 409):**
```json
{
  "namaKategori": "Minuman Segar",
  "kodeKategori": "MNM-DUP"
}
```

**c) Get kategori dengan ID tidak valid (404):**
- **URL:** `{{base_url}}/kategori/id-tidak-ada-sama-sekali`

**d) Request tanpa token (401 Unauthorized):**
- Hapus header `Authorization` lalu kirim request manapun.
Expected:
```json
{
  "message": "Akses ditolak. Token pengguna tidak ditemukan."
}
```

---

## 💰 MODUL 2 — PAJAK

**Base URL Modul:** `{{base_url}}/pajak`

Modul Pajak mengelola konfigurasi pajak yang dapat diaplikasikan pada produk (Per Produk) atau seluruh transaksi (Per Transaksi).

### Schema Data Pajak
| Field | Tipe | Wajib | Nilai Valid | Keterangan |
|---|---|---|---|---|
| `namaPajak` | String | ✅ Ya | ─ | Nama pajak, unik per tenant |
| `tarifPajak` | Number | ✅ Ya | `0–100` | Persentase tarif pajak |
| `tipePajak` | Boolean | ✅ Ya | `true` / `false` | `true` = Per Produk, `false` = Per Transaksi |
| `modelPerhitungan` | Number | ✅ Ya | `1`, `2`, atau `3` | `1=Inclusive`, `2=Exclusive`, `3=Compound` |
| `prioritas` | Number | ✅ Ya | `1` atau `2` | Urutan penerapan pajak |
| `statusPajak` | Boolean | ❌ Tidak | `true` / `false` | Default: `true` (aktif) |

### Penjelasan Model Perhitungan
| Model | Nama | Cara Kerja |
|---|---|---|
| `1` | **Inclusive** | Pajak sudah termasuk dalam harga. Harga tampil sudah termasuk pajak. |
| `2` | **Exclusive** | Pajak dihitung di atas harga dasar (ditambahkan ke harga). |
| `3` | **Compound** | Pajak dihitung di atas harga yang sudah ditambahkan pajak sebelumnya (pajak berganda). |

---

### 2.1 — Create Pajak (Per Produk — Exclusive)
- **Method:** `POST`
- **URL:** `{{base_url}}/pajak`
- **Headers:** _(Gunakan header standar)_
- **Body (raw JSON):**
```json
{
  "namaPajak": "PPN Produk 11%",
  "tarifPajak": 11,
  "tipePajak": true,
  "modelPerhitungan": 2,
  "prioritas": 1,
  "statusPajak": true
}
```
- **Response Sukses (201):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b6001",
    "namaPajak": "PPN Produk 11%",
    "tarifPajak": 11,
    "tipePajak": true,
    "modelPerhitungan": 2,
    "statusPajak": true,
    "prioritas": 1,
    "tenantID": "60d5ecb8b89c2a001c8b1234",
    "createdAt": "2026-05-24T15:00:00.000Z"
  }
}
```
> 💡 Simpan `data._id` sebagai `{{pajak_produk_id}}`.

**Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Pajak berhasil dibuat", () => {
    const json = pm.response.json();
    pm.expect(json.success).to.be.true;
    pm.expect(json.data._id).to.exist;
    pm.collectionVariables.set("pajak_produk_id", json.data._id);
});
```

---

### 2.2 — Create Pajak (Per Transaksi — Inclusive)
> Pajak jenis ini diterapkan pada total keseluruhan transaksi. Hanya satu pajak Per Transaksi yang bisa aktif sekaligus — sistem akan otomatis menonaktifkan pajak transaksi lain yang aktif.

- **Method:** `POST`
- **URL:** `{{base_url}}/pajak`
- **Body (raw JSON):**
```json
{
  "namaPajak": "Service Charge 5%",
  "tarifPajak": 5,
  "tipePajak": false,
  "modelPerhitungan": 2,
  "prioritas": 2,
  "statusPajak": true
}
```
- **Response Sukses (201):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b6002",
    "namaPajak": "Service Charge 5%",
    "tarifPajak": 5,
    "tipePajak": false,
    "modelPerhitungan": 2,
    "statusPajak": true,
    "prioritas": 2,
    "tenantID": "60d5ecb8b89c2a001c8b1234"
  }
}
```
> 💡 Simpan `data._id` sebagai `{{pajak_transaksi_id}}`.

---

### 2.3 — Create Pajak Compound (Untuk Simulasi Multi-Pajak)
```json
{
  "namaPajak": "Pajak Compound 10%",
  "tarifPajak": 10,
  "tipePajak": true,
  "modelPerhitungan": 3,
  "prioritas": 2,
  "statusPajak": true
}
```
> 💡 Simpan `data._id` sebagai `{{pajak_compound_id}}`.

---

### 2.4 — Get All Pajak
- **Method:** `GET`
- **URL:** `{{base_url}}/pajak`
- **Body:** _(Tidak ada)_
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ecb8b89c2a001c8b6001",
      "namaPajak": "PPN Produk 11%",
      "tarifPajak": 11,
      "tipePajak": true,
      "modelPerhitungan": 2,
      "statusPajak": true,
      "prioritas": 1
    },
    {
      "_id": "60d5ecb8b89c2a001c8b6002",
      "namaPajak": "Service Charge 5%",
      "tarifPajak": 5,
      "tipePajak": false,
      "modelPerhitungan": 2,
      "statusPajak": true,
      "prioritas": 2
    }
  ]
}
```

---

### 2.5 — Get Pajak by ID
- **Method:** `GET`
- **URL:** `{{base_url}}/pajak/{{pajak_produk_id}}`
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b6001",
    "namaPajak": "PPN Produk 11%",
    "tarifPajak": 11,
    "tipePajak": true,
    "modelPerhitungan": 2,
    "statusPajak": true,
    "prioritas": 1,
    "tenantID": "60d5ecb8b89c2a001c8b1234"
  }
}
```

---

### 2.6 — Update Pajak
- **Method:** `PUT`
- **URL:** `{{base_url}}/pajak/{{pajak_produk_id}}`
- **Body (raw JSON):**
```json
{
  "tarifPajak": 12,
  "statusPajak": true
}
```
- **Response Sukses (200):**
```json
{
  "success": true,
  "message": "Pajak diperbarui",
  "data": {
    "_id": "60d5ecb8b89c2a001c8b6001",
    "namaPajak": "PPN Produk 11%",
    "tarifPajak": 12,
    "tipePajak": true,
    "modelPerhitungan": 2,
    "statusPajak": true,
    "prioritas": 1
  }
}
```

---

### 2.7 — Simulasi Pajak Per Produk 🧮
Endpoint ini menghitung estimasi pajak untuk sebuah produk berdasarkan pajak yang telah di-assign ke produk tersebut.

- **Method:** `POST`
- **URL:** `{{base_url}}/pajak/simulasi-produk`
- **Body (raw JSON):**
```json
{
  "produkID": "{{produk_id}}",
  "harga": 50000
}
```
> ⚠️ Pastikan produk sudah dibuat dan sudah di-assign pajak (lihat Modul 3 dan Bagian Relasi Produk-Pajak).

- **Response Sukses (200):**
```json
{
  "success": true,
  "data": {
    "hargaAwal": 50000,
    "totalPajak": 5500,
    "grandTotal": 55500,
    "rincian": [
      {
        "_id": "60d5ecb8b89c2a001c8b6001",
        "namaPajak": "PPN Produk 11%",
        "tarifPajak": 11,
        "jumlah": 5500,
        "model": "Exclusive"
      }
    ]
  }
}
```

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Kalkulasi pajak valid", () => {
    const json = pm.response.json();
    pm.expect(json.data.grandTotal).to.equal(json.data.hargaAwal + json.data.totalPajak);
});
```

---

### 2.8 — Simulasi Pajak Per Transaksi 🧮
Endpoint ini menghitung estimasi pajak untuk seluruh total transaksi.

- **Method:** `POST`
- **URL:** `{{base_url}}/pajak/simulasi-transaksi`
- **Body (raw JSON):**
```json
{
  "subtotal": 200000
}
```
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": {
    "hargaAwal": 200000,
    "totalPajak": 10000,
    "grandTotal": 210000,
    "rincian": [
      {
        "_id": "60d5ecb8b89c2a001c8b6002",
        "namaPajak": "Service Charge 5%",
        "tarifPajak": 5,
        "jumlah": 10000,
        "model": "Exclusive"
      }
    ]
  }
}
```

**Test Data Variasi Simulasi Transaksi:**
```json
{ "subtotal": 0 }
```
Expected: `totalPajak = 0`, `grandTotal = 0`

```json
{ "subtotal": 1000000 }
```
Expected: `totalPajak = 50000`, `grandTotal = 1050000`

---

### 2.9 — Delete Pajak

> ⚠️ **PERHATIAN:** Menghapus pajak akan otomatis menghapus semua relasi Produk-Pajak yang terkait dan membersihkan cache produk.

- **Method:** `DELETE`
- **URL:** `{{base_url}}/pajak/{{pajak_compound_id}}`
- **Response Sukses (200):**
```json
{
  "success": true,
  "message": "Pajak berhasil dihapus."
}
```

---

### ❌ Skenario Error Pajak

**a) Buat pajak tanpa `namaPajak` (400):**
```json
{
  "tarifPajak": 10,
  "tipePajak": true,
  "modelPerhitungan": 2,
  "prioritas": 1
}
```
Expected:
```json
{
  "success": false,
  "errors": ["namaPajak wajib diisi"]
}
```

**b) `tarifPajak` lebih dari 100 (400):**
```json
{
  "namaPajak": "Pajak Invalid",
  "tarifPajak": 150,
  "tipePajak": true,
  "modelPerhitungan": 2,
  "prioritas": 1
}
```
Expected:
```json
{
  "success": false,
  "errors": ["tarifPajak tidak boleh > 100%"]
}
```

**c) `modelPerhitungan` tidak valid (400):**
```json
{
  "namaPajak": "Pajak Invalid",
  "tarifPajak": 10,
  "tipePajak": true,
  "modelPerhitungan": 99,
  "prioritas": 1
}
```

**d) `tipePajak` bukan boolean (400):**
```json
{
  "namaPajak": "Pajak Invalid",
  "tarifPajak": 10,
  "tipePajak": "ya",
  "modelPerhitungan": 2,
  "prioritas": 1
}
```

**e) Get pajak dengan ID tidak ditemukan (404):**
- **URL:** `{{base_url}}/pajak/000000000000000000000000`
Expected:
```json
{
  "message": "Data pajak tidak ditemukan."
}
```

---

## 📦 MODUL 3 — PRODUK

**Base URL Modul:** `{{base_url}}/produk`

> **Prasyarat:** Kategori (`{{kategori_id}}`) harus sudah dibuat sebelum membuat produk.

### Schema Data Produk
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `namaProduk` | String | ✅ Ya | Nama produk, unik per tenant |
| `hargaJual` | Number | ✅ Ya | Harga jual (>= 0) |
| `hargaDasar` | Number | ✅ Ya | Harga pokok / dasar (>= 0) |
| `kategoriID` | ObjectId | ✅ Ya | ID kategori yang valid |
| `keterangan` | String | ❌ Tidak | Deskripsi produk |
| `gambarProduk` | String | ❌ Tidak | URL gambar produk |
| `resep` | Array | ❌ Tidak | Daftar bahan baku untuk produk racikan |
| `resep[].bahanBakuID` | ObjectId | ✅ (jika ada resep) | ID bahan baku |
| `resep[].jumlah` | Number | ✅ (jika ada resep) | Jumlah bahan (> 0) |
| `resep[].satuan` | String | ✅ (jika ada resep) | `gram`, `ml`, `pcs`, `kg`, atau `liter` |

---

### 3.1 — Create Produk (Tanpa Resep)
- **Method:** `POST`
- **URL:** `{{base_url}}/produk`
- **Headers:** _(Gunakan header standar)_
- **Body (raw JSON):**
```json
{
  "namaProduk": "Es Teh Manis",
  "hargaJual": 8000,
  "hargaDasar": 3000,
  "kategoriID": "{{kategori_id}}",
  "keterangan": "Teh manis dingin segar"
}
```
- **Response Sukses (201):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b7001",
    "namaProduk": "Es Teh Manis",
    "hargaJual": 8000,
    "hargaDasar": 3000,
    "stok": 0,
    "kategoriID": "60d5ecb8b89c2a001c8b5001",
    "tenantID": "60d5ecb8b89c2a001c8b1234",
    "keterangan": "Teh manis dingin segar",
    "gambarProduk": null,
    "resep": [],
    "pajak": [],
    "createdAt": "2026-05-24T15:00:00.000Z"
  }
}
```
> 💡 Simpan `data._id` sebagai `{{produk_id}}`.

**Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Produk berhasil dibuat", () => {
    const json = pm.response.json();
    pm.expect(json.success).to.be.true;
    pm.expect(json.data.namaProduk).to.equal("Es Teh Manis");
    pm.collectionVariables.set("produk_id", json.data._id);
});
```

---

### 3.2 — Create Produk (Dengan Resep)
Digunakan untuk produk yang dibuat dari bahan baku (produk racikan).

> ⚠️ Pastikan `bahanBakuID` yang digunakan sudah ada di database.

- **Method:** `POST`
- **URL:** `{{base_url}}/produk`
- **Body (raw JSON):**
```json
{
  "namaProduk": "Kopi Susu Spesial",
  "hargaJual": 22000,
  "hargaDasar": 8000,
  "kategoriID": "{{kategori_id}}",
  "keterangan": "Kopi susu premium dengan biji pilihan",
  "resep": [
    {
      "bahanBakuID": "{{bahan_baku_kopi_id}}",
      "jumlah": 18,
      "satuan": "gram"
    },
    {
      "bahanBakuID": "{{bahan_baku_susu_id}}",
      "jumlah": 150,
      "satuan": "ml"
    },
    {
      "bahanBakuID": "{{bahan_baku_gula_id}}",
      "jumlah": 20,
      "satuan": "gram"
    }
  ]
}
```
> 💡 Simpan `data._id` sebagai `{{produk_resep_id}}`.

---

**Test Data Produk Tambahan (untuk variasi pengujian):**

**Produk 3 — Makanan:**
```json
{
  "namaProduk": "Nasi Goreng Spesial",
  "hargaJual": 25000,
  "hargaDasar": 10000,
  "kategoriID": "{{kategori_makanan_id}}",
  "keterangan": "Nasi goreng dengan topping lengkap"
}
```

**Produk 4 — Snack:**
```json
{
  "namaProduk": "Keripik Singkong",
  "hargaJual": 12000,
  "hargaDasar": 5000,
  "kategoriID": "{{kategori_snack_id}}",
  "keterangan": "Keripik singkong renyah rasa original"
}
```

---

### 3.3 — Get All Produk
- **Method:** `GET`
- **URL:** `{{base_url}}/produk`
- **Body:** _(Tidak ada)_
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ecb8b89c2a001c8b7001",
      "namaProduk": "Es Teh Manis",
      "hargaJual": 8000,
      "hargaDasar": 3000,
      "stok": 0,
      "kategoriID": {
        "_id": "60d5ecb8b89c2a001c8b5001",
        "namaKategori": "Minuman"
      },
      "pajak": [],
      "resep": []
    }
  ]
}
```

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Data produk ada", () => {
    const json = pm.response.json();
    pm.expect(json.data).to.be.an("array");
});
```

---

### 3.4 — Get Produk by ID
- **Method:** `GET`
- **URL:** `{{base_url}}/produk/{{produk_id}}`
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b7001",
    "namaProduk": "Es Teh Manis",
    "hargaJual": 8000,
    "hargaDasar": 3000,
    "stok": 0,
    "kategoriID": "60d5ecb8b89c2a001c8b5001",
    "keterangan": "Teh manis dingin segar",
    "gambarProduk": null,
    "resep": [],
    "pajak": []
  }
}
```

---

### 3.5 — Update Produk
- **Method:** `PUT`
- **URL:** `{{base_url}}/produk/{{produk_id}}`
- **Body (raw JSON):**
```json
{
  "hargaJual": 9000,
  "keterangan": "Teh manis dingin dengan es batu premium"
}
```
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b7001",
    "namaProduk": "Es Teh Manis",
    "hargaJual": 9000,
    "keterangan": "Teh manis dingin dengan es batu premium",
    "updatedAt": "2026-05-24T16:00:00.000Z"
  }
}
```

**Test Data Update Lainnya:**

Update harga dasar:
```json
{ "hargaDasar": 3500 }
```

Update resep:
```json
{
  "resep": [
    {
      "bahanBakuID": "{{bahan_baku_teh_id}}",
      "jumlah": 5,
      "satuan": "gram"
    }
  ]
}
```

---

### 3.6 — Delete Produk

> ⚠️ **PERHATIAN:** Jalankan ini SETELAH semua relasi Produk-Pajak selesai diuji.

- **Method:** `DELETE`
- **URL:** `{{base_url}}/produk/{{produk_id}}`
- **Response Sukses (200):**
```json
{
  "success": true,
  "message": "Produk berhasil dihapus."
}
```

---

### ❌ Skenario Error Produk

**a) Create produk tanpa `namaProduk` (400):**
```json
{
  "hargaJual": 10000,
  "hargaDasar": 5000,
  "kategoriID": "{{kategori_id}}"
}
```

**b) Create produk dengan `hargaJual` negatif (400):**
```json
{
  "namaProduk": "Produk Test",
  "hargaJual": -100,
  "hargaDasar": 5000,
  "kategoriID": "{{kategori_id}}"
}
```

**c) Create produk dengan `kategoriID` tidak valid (400):**
```json
{
  "namaProduk": "Produk Test",
  "hargaJual": 10000,
  "hargaDasar": 5000,
  "kategoriID": "bukan-object-id-valid"
}
```
Expected:
```json
{
  "message": "kategoriID wajib diisi dan valid"
}
```

**d) Create produk dengan satuan resep tidak valid (400):**
```json
{
  "namaProduk": "Produk Resep Invalid",
  "hargaJual": 15000,
  "hargaDasar": 5000,
  "kategoriID": "{{kategori_id}}",
  "resep": [
    {
      "bahanBakuID": "{{bahan_baku_id}}",
      "jumlah": 100,
      "satuan": "ons"
    }
  ]
}
```
Expected: satuan `ons` tidak valid (hanya: `gram`, `ml`, `pcs`, `kg`, `liter`).

**e) Get produk yang tidak ada (404):**
- **URL:** `{{base_url}}/produk/000000000000000000000000`
Expected:
```json
{
  "message": "Produk tidak ditemukan."
}
```

---

## 🔗 MODUL RELASI — PRODUK-PAJAK

**Base URL Modul:** `{{base_url}}/produkpajak`

Modul ini menghubungkan Produk dengan Pajak yang berlaku untuk produk tersebut.

### 4.1 — Assign Pajak ke Produk
- **Method:** `POST`
- **URL:** `{{base_url}}/produkpajak`
- **Body (raw JSON):**
```json
{
  "produkID": "{{produk_id}}",
  "pajakID": "{{pajak_produk_id}}"
}
```
- **Response Sukses (201):**
```json
{
  "success": true,
  "data": {
    "_id": "60d5ecb8b89c2a001c8b8001",
    "produkID": "60d5ecb8b89c2a001c8b7001",
    "pajakID": "60d5ecb8b89c2a001c8b6001",
    "tenantID": "60d5ecb8b89c2a001c8b1234",
    "createdAt": "2026-05-24T15:00:00.000Z"
  }
}
```
> 💡 Simpan `data._id` sebagai `{{relasi_produk_pajak_id}}`.

**Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Relasi berhasil dibuat", () => {
    const json = pm.response.json();
    pm.expect(json.success).to.be.true;
    pm.collectionVariables.set("relasi_produk_pajak_id", json.data._id);
});
```

---

### 4.2 — Get Pajak by Produk
- **Method:** `GET`
- **URL:** `{{base_url}}/produkpajak/{{produk_id}}`
- **Response Sukses (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "60d5ecb8b89c2a001c8b8001",
      "pajak": {
        "_id": "60d5ecb8b89c2a001c8b6001",
        "namaPajak": "PPN Produk 11%",
        "tarifPajak": 11,
        "tipePajak": true,
        "modelPerhitungan": 2,
        "statusPajak": true
      }
    }
  ]
}
```

---

### 4.3 — Unassign (Hapus Relasi) Pajak dari Produk
- **Method:** `DELETE`
- **URL:** `{{base_url}}/produkpajak/{{relasi_produk_pajak_id}}`
- **Response Sukses (200):**
```json
{
  "success": true,
  "message": "Relasi pajak berhasil dihapus."
}
```

---

### ❌ Skenario Error Relasi Produk-Pajak

**a) Assign tanpa `produkID` maupun `assetID` (400):**
```json
{
  "pajakID": "{{pajak_produk_id}}"
}
```
Expected:
```json
{
  "success": false,
  "errors": ["Wajib mengisi salah satu antara produkID atau assetID yang valid"]
}
```

**b) Assign dengan keduanya `produkID` dan `assetID` sekaligus (400):**
```json
{
  "produkID": "{{produk_id}}",
  "assetID": "{{aset_id}}",
  "pajakID": "{{pajak_produk_id}}"
}
```
Expected:
```json
{
  "success": false,
  "errors": ["Hanya boleh mengisi salah satu antara produkID atau assetID"]
}
```

---

## 🚀 URUTAN PENGUJIAN YANG DIREKOMENDASIKAN (End-to-End Flow)

Ikuti urutan ini untuk pengujian dari awal hingga akhir yang paling optimal:

```
FASE 1 — AUTENTIKASI
└── [0.1] Login Akun        → Simpan akun_token
└── [0.2] Login Pengguna    → Simpan pengguna_token + tenant_id

FASE 2 — KATEGORI
└── [1.1] Create Kategori "Minuman"  → Simpan kategori_id
└── [1.1] Create Kategori "Makanan"  → Simpan kategori_makanan_id
└── [1.2] Get All Kategori           → Verifikasi 2 kategori muncul
└── [1.3] Get by ID                  → Verifikasi data spesifik
└── [1.4] Update Kategori            → Ubah nama jadi "Minuman Segar"
└── [1.3] Get by ID (verify)         → Pastikan update berhasil

FASE 3 — PAJAK
└── [2.1] Create Pajak PPN 11%       → Simpan pajak_produk_id
└── [2.2] Create Pajak Service 5%    → Simpan pajak_transaksi_id
└── [2.4] Get All Pajak              → Verifikasi 2 pajak muncul
└── [2.5] Get by ID                  → Verifikasi data spesifik
└── [2.6] Update Pajak               → Ubah tarif

FASE 4 — PRODUK
└── [3.1] Create Produk "Es Teh Manis" → Simpan produk_id
└── [3.3] Get All Produk               → Verifikasi produk muncul
└── [3.4] Get by ID                    → Verifikasi detail produk
└── [3.5] Update Produk                → Ubah harga jual

FASE 5 — RELASI PRODUK-PAJAK
└── [4.1] Assign Pajak ke Produk    → Hubungkan produk_id + pajak_produk_id
└── [4.2] Get Pajak by Produk       → Verifikasi pajak terpasang

FASE 6 — SIMULASI PAJAK
└── [2.7] Simulasi Per Produk       → Hitung pajak untuk produk + harga tertentu
└── [2.8] Simulasi Per Transaksi    → Hitung pajak service charge

FASE 7 — CLEANUP (Opsional)
└── [4.3] Unassign Pajak dari Produk → Lepas relasi
└── [3.6] Delete Produk              → Hapus produk
└── [2.9] Delete Pajak               → Hapus pajak
└── [1.5] Delete Kategori            → Hapus kategori
```

---

## 📋 Rangkuman Seluruh Endpoint

### Kategori (`/api/kategori`)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/kategori` | Buat kategori baru |
| `GET` | `/kategori` | Ambil semua kategori |
| `GET` | `/kategori/:id` | Ambil kategori by ID |
| `PUT` | `/kategori/:id` | Update kategori |
| `DELETE` | `/kategori/:id` | Hapus kategori |

### Pajak (`/api/pajak`)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/pajak` | Buat pajak baru |
| `POST` | `/pajak/simulasi-produk` | Simulasi pajak per produk |
| `POST` | `/pajak/simulasi-transaksi` | Simulasi pajak per transaksi |
| `GET` | `/pajak` | Ambil semua pajak |
| `GET` | `/pajak/:id` | Ambil pajak by ID |
| `PUT` | `/pajak/:id` | Update pajak |
| `DELETE` | `/pajak/:id` | Hapus pajak |

### Produk (`/api/produk`)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/produk` | Buat produk baru |
| `GET` | `/produk` | Ambil semua produk |
| `GET` | `/produk/:id` | Ambil produk by ID |
| `PUT` | `/produk/:id` | Update produk |
| `DELETE` | `/produk/:id` | Hapus produk |

### Relasi Produk-Pajak (`/api/produkpajak`)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/produkpajak` | Assign pajak ke produk |
| `GET` | `/produkpajak/:targetID` | Ambil pajak dari produk |
| `DELETE` | `/produkpajak/:id` | Hapus relasi pajak-produk |

---

## 🔑 Variabel Postman (Collection Variables)

Tambahkan variabel berikut di **Collection → Variables** pada Postman:

| Variable | Initial Value | Keterangan |
|---|---|---|
| `base_url` | `http://localhost:3000/api` | URL dasar API |
| `akun_token` | _(kosong)_ | Diisi otomatis setelah Login Akun |
| `pengguna_token` | _(kosong)_ | Diisi otomatis setelah Login Pengguna |
| `tenant_id` | _(kosong)_ | Diisi otomatis setelah Login Pengguna |
| `kategori_id` | _(kosong)_ | Diisi otomatis setelah Create Kategori |
| `kategori_makanan_id` | _(kosong)_ | ID Kategori Makanan |
| `kategori_snack_id` | _(kosong)_ | ID Kategori Snack |
| `pajak_produk_id` | _(kosong)_ | ID Pajak Per Produk |
| `pajak_transaksi_id` | _(kosong)_ | ID Pajak Per Transaksi |
| `pajak_compound_id` | _(kosong)_ | ID Pajak Compound |
| `produk_id` | _(kosong)_ | ID Produk Utama |
| `produk_resep_id` | _(kosong)_ | ID Produk dengan Resep |
| `relasi_produk_pajak_id` | _(kosong)_ | ID Relasi Produk-Pajak |
