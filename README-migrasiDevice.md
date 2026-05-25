# Manajemen Perangkat API — Laporan Migrasi & Dokumentasi

---

## 1. Ringkasan Arsitektur Autentikasi Baru

Migrasi ini dilakukan untuk menambal celah keamanan fatal berupa _device bypass_, di mana pengguna dengan jabatan tinggi seperti Owner sebelumnya dapat masuk ke aplikasi kasir (POS) tanpa melalui validasi perangkat.

### Perubahan Konsep Utama

**Pemisahan Entitas**
Manajemen perangkat dan `aksesType` (`"web"` vs `"app"`) kini sepenuhnya dipindahkan dari level Akun (SaaS Global) ke level Pengguna (Tenant/Toko).

**Sistem Dual JWT**

- **Akses Web (Dashboard):** Divalidasi menggunakan `tokenVersion` pada root profil pengguna.
- **Akses App (Kasir POS):** Divalidasi secara ketat menggunakan kombinasi `deviceID` spesifik dan `tokenVersion` milik perangkat tersebut di dalam array perangkat pengguna.

---

## 2. Rekapitulasi Perubahan Kode

### A. Lapisan Model — `penggunaModel.js`

- Menambahkan enum `aksesType` (`web`, `app`) dengan nilai default `app`.
- Menambahkan batasan keamanan `maxPrimaryDevice` dan `maxDevice`.
- Menyematkan array sub-dokumen `device` yang memuat `deviceID`, `type`, `tokenVersion`, dan `lastUsed`.
- Menyematkan array sub-dokumen `deviceHistory` untuk audit mutasi perangkat.

### B. Lapisan Validator — `akunValidator.js`

- Memisahkan validasi login murni (tanpa `deviceID`) dengan validasi mutasi perangkat (`validateDeviceAction`).
- Menyempurnakan fungsi `isDisposableEmail` untuk memblokir pendaftaran dari layanan email sampah.

### C. Lapisan Middleware — `authAkun.js` & `authPengguna.js`

**`authAkun`**

- Menambahkan validasi `tokenVersion` untuk mendukung fitur Global Logout.
- Menangani ketiadaan `tenantID` bagi akun yang baru mendaftar dan belum menyelesaikan proses onboarding.

**`authPengguna` (Perbaikan Kritis)**

- Menutup celah bypass secara menyeluruh. Jika `aksesType` adalah `"app"`, middleware wajib memverifikasi keberadaan `deviceID` di dalam payload token dan mencocokkannya dengan data di database.
- Menambahkan perlindungan terhadap Orphan Data, yaitu kondisi di mana User atau Role dihapus oleh manajer saat sesi pengguna masih aktif.

### D. Lapisan Service — `penggunaService.js`

**Fungsi `refreshToken` — Direfaktor Total**

- Untuk akses web: rotasi dilakukan pada `tokenVersion` root.
- Untuk akses app: rotasi dilingkupkan secara eksklusif pada `tokenVersion` perangkat spesifik (`device[x].tokenVersion`).
- Transisi lintas platform ditangani secara elegan — token web yang mencoba melakukan refresh setelah tipe akses diubah ke app akan ditolak.

### E. Lapisan Controller — `akunController.js`

- Memperbaiki bug `500 Internal Server Error` melalui injeksi objek fallback (`req.cookies || {}` dan `req.body || {}`) pada metode `refreshToken` dan `logout`, sehingga kebal terhadap request yang dikirimkan dalam keadaan kosong.

---

## 3. Rekapitulasi Pengujian

Seluruh komponen telah diuji dengan Unit Test dan Integration Test secara agresif, mencapai cakupan 100% pada semua edge case.

| File Pengujian          | Skenario | Deskripsi                                                                                                            |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `auth.test.js`          | 13 lulus | Registrasi, penolakan email disposable, penolakan duplikasi, login, keamanan manipulasi token                        |
| `authAkun.test.js`      | 10 lulus | Kompatibilitas token lama, serangan token palsu, simulasi kegagalan infrastruktur (DB crash)                         |
| `penggunaModel.test.js` | 7 lulus  | Keamanan sub-dokumen — menolak `deviceID` kosong, mendeteksi mutasi history ilegal                                   |
| `authPengguna.test.js`  | 13 lulus | Pemblokiran absolut terhadap Device Hantu (perangkat tak terdaftar) dari aplikasi kasir, meskipun diakses oleh Owner |
| `akunValidator.test.js` | 14 lulus | Stress test regex terhadap password lemah dan pola email palsu                                                       |
| `refreshToken.test.js`  | 13 lulus | Ketepatan rotasi JWT, kegagalan saat Role dihapus mendadak (Orphan Data), kedaluwarsa sesi secara alami              |

---

## 4. Dokumentasi API

### Login — Akun SaaS (Web Dashboard)

Digunakan oleh pemilik bisnis untuk masuk ke dasbor manajemen. Tidak terikat pada perangkat tertentu.

**Endpoint**

```
POST /api/akun/auth/login
```

**Body Request**

```json
{
  "email": "owner@tachyon.co.id",
  "password": "PasswordKuat123!"
}
```

**Respons Berhasil — 200 OK**

Mengembalikan `accessToken`. `refreshToken` disimpan di dalam HTTP-Only Cookie.

---

### daftar pengguna

Digunakan untuk daftar pengguna, akses type bisa pilih salah satu antara web atau app, ataupun bisa pilih keduanya.

**Endpoint**

```
POST /api/pengguna/register-owner
POST /api/pengguna/register-pengguna
```

**Body Request**

jika ingin hanya bisa dipakai di app

```json
{
  "nama": "nama pengguna",
  "pin": "123456",
  "deviceID": "DEV-MAC-001",
  "aksesType": "app"
}
```

jika hanya ingin bisa dipakai di web

```json
{
  "nama": "nama pengguna",
  "pin": "123456",
  "aksesType": "web"
}
```

jika ingin bisa dipakai di web dan app

```json
{
  "nama": "nama pengguna",
  "pin": "123456",
  "deviceID": "DEV-MAC-001",
  "aksesType": [
    "web", 
    "app"
  ]
}
```

### Login — Pengguna (Aplikasi Kasir / POS)

Digunakan oleh kasir dan staf di lapangan. Sangat ketat dan terikat pada perangkat.

**Endpoint**

```
POST /api/pengguna/pin-login
```

**Body Request**

jika lewat aplikasi, maka jsonnya seperti ini

```json
{
  "nama": "nama pengguna",
  "pin": "123456",
  "deviceID": "DEV-MAC-001",
  "aksesType": "app"
}
```

jika lewat website, maka jsonnya seperti ini

```json
{
  "nama": "nama pengguna",
  "pin": "123456",
  "aksesType": "web"
}
```

> **Catatan:** `deviceID` bersifat wajib untuk akses melalui aplikasi.

**Respons Berhasil — 200 OK**

Mengembalikan pasangan access token dan refresh token yang payload-nya telah dibubuhi `deviceID` dan versi perangkat.

---

### Pembaruan Sesi (Refresh Token)

Sistem menggunakan rotasi JWT otomatis. Klien wajib memanggil endpoint ini ketika Access Token kedaluwarsa (401).

**Endpoint**

```
POST /api/pengguna/pin-refresh
```

**Kondisi Pengiriman**

- Aplikasi web mengirimkannya melalui Cookie.
- Aplikasi mobile dapat mengirimkannya melalui body request:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

**Respons**

- Jika perangkat sah dan belum diblokir atau di-reset oleh manajer, sistem akan menerbitkan pasangan token baru.
- Jika manajer telah mencabut akses perangkat tersebut, sistem akan membalas dengan `401 Unauthorized` (Sesi Kedaluwarsa / Tidak Dikenali).

---
