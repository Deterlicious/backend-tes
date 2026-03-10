# Dokumentasi API Metode Pembayaran

## 1. Mendaftarkan Permission Metode Pembayaran

Akses untuk menentukan laci kas mana yang mau dimatikan atau dihidupkan untuk umum. Lazimnya dikelola *Accounting* atau *Admin*.

**URL Tujuan:** `POST /api/permissions`

**Body JSON Request:**
```json
{
  "namaPermission": "Kelola Cara Bayar",
  "deskripsi": "Akses menyetel jenis kasir pembayaran, mencakup laci tunai EDC, maupun konfigurasi API Pihak ketiga Automasi."
}
```

---

## 2. Pengetesan CRUD Metode Pembayaran (Postman / Insomnia)

Pastikan Header `Authorization: Bearer <token_anda>` teraplikasi.
Endpoint dasar: `/api/metode-pembayaran` *(Gunakan route sesuai tata file project Anda)*

### A. CREATE Metode Pembayaran (Mendaftarkan EDC / Gateway)
- Kasus 1: Buat laci uang kas biasa (Tunai).
- Kasus 2: Daftarkan Gateway Channel Xendit OVO (Otomatis).

**Method:** `POST`
**URL:** `/api/metode-pembayaran`

**Body JSON (Kasus Tunai Laci Biasa):**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1111",
  "akunKasID": "64efc9d1a3b8c6e2a84d2222",
  "namaPembayaran": "Uang Kas Kasir Tunai",
  "kategori": "tunai",
  "isAutomated": false,
  "isActive": true
}
```

**Body JSON (Kasus Automasi - QRIS XENDIT):**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1111",
  "akunKasID": "64efc9d1a3b8c6e2a84d3333",
  "namaPembayaran": "Scan DANA / OVO Xendit",
  "kategori": "non-tunai",
  "isAutomated": true,
  "xenditChannelCode": "ID_DANA_GATEWAY",
  "isActive": true
}
```

### B. READ All
Mengumpulkan list channel yang akan ditaruh di list-dropdown halaman kasir POS.

**Method:** `GET`
**URL:** `/api/metode-pembayaran`

### C. READ By ID

**Method:** `GET`
**URL:** `/api/metode-pembayaran/:id` 

### D. UPDATE Metode (Matikan/Tunda Layanan EDC Sementara)
Jika bank sedang maintenance error, admin kasir bisa menutup jalurnya dengan mematikan toggle `isActive`.

**Method:** `PUT`
**URL:** `/api/metode-pembayaran/:id`
**Body JSON:**
```json
{
  "isActive": false
}
```

### E. DELETE Metode Pembayaran
Bila channel ini selamanya diputus afiliasinya misalnya toko putus kontrak dengan Xendit, metode ini bisa di *hard-delete*.

**Method:** `DELETE`
**URL:** `/api/metode-pembayaran/:id`
