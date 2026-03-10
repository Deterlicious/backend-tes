# Dokumentasi API Diskon & Promosi

## 1. Mendaftarkan Permission Master Diskon

Manajemen promosi hanya pantas dipegang oleh *Manager* atau *Developer*, karena bisa berpotensi merugikan laba cabang jika disalahfungsikan.

**URL Tujuan:** `POST /api/permissions`

**Body JSON Request:**
```json
{
  "namaPermission": "Manajemen Promosi Diskon",
  "deskripsi": "Memberikan hak eksklusif untuk menciptakan, menyunting status, dan mematikan master voucher promosi."
}
```

---

## 2. Pengetesan CRUD Diskon (Postman / Insomnia)

Pastikan Header: `Authorization: Bearer <token_anda>`.
Endpoint pengujian: `/api/diskon`

### A. CREATE Diskon (Launching Promo Baru)
Mari kita ciptakan diskon lebaran potongan nota langsung!

**Method:** `POST`
**URL:** `/api/diskon`
**Body JSON:**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1111",
  "namaDiskon": "Promo Lebaran Rp50.000",
  "cakupan": "Global",
  "tipe": "nominal",
  "nilai": 50000,
  "bisaDigabung": false,
  "status": "Aktif"
}
```

**B. (Contoh Diskon Item Persen):**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1111",
  "namaDiskon": "Kopi Senin Diskon 20%",
  "cakupan": "Item",
  "tipe": "persen",
  "nilai": 20,
  "bisaDigabung": true,
  "status": "Aktif"
}
```

### B. READ All
Lihat direktori seluruh program event potongan harga yang tersedia toko tersebut.

**Method:** `GET`
**URL:** `/api/diskon`

### C. READ By ID

**Method:** `GET`
**URL:** `/api/diskon/:id` 

### D. UPDATE Diskon (Mematikan Promo Kadaluarsa)
Kasus tersering adalah ketika tanggal merah berakhir, admin mengubah field `status` promonya jadi tutup, alias Non-Aktif.

**Method:** `PUT`
**URL:** `/api/diskon/:id`
**Body JSON:**
```json
{
  "status": "Non-Aktif"
}
```

### E. DELETE Diskon
Mencabut master kode promo dari sistem database selamanya.

**Method:** `DELETE`
**URL:** `/api/diskon/:id`
