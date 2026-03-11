# Pembayaran Management API

Dokumentasi ini menjelaskan cara melakukan **pengujian CRUD Metode Pembayaran dan Pembayaran** menggunakan Postman.

Fitur ini terdiri dari dua modul utama:

- **Metode Pembayaran**
- **Pembayaran**

---

# Permission yang Dibutuhkan

Fitur ini membutuhkan permission berikut:

```
kelola-metode-pembayaran
kelola-pembayaran
```

Permission tersebut memberikan akses untuk:

### Metode Pembayaran
- Melihat daftar metode pembayaran
- Melihat detail metode pembayaran
- Membuat metode pembayaran
- Mengubah metode pembayaran
- Menghapus metode pembayaran

### Pembayaran
- Melihat daftar pembayaran
- Melihat detail pembayaran
- Membuat pembayaran
- Mengubah pembayaran
- Menghapus pembayaran

Jika pengguna tidak memiliki permission tersebut maka API akan mengembalikan response **403 Forbidden**.

---

# Authorization

Semua endpoint membutuhkan **Bearer Token**.

### Cara menggunakan Bearer Token di Postman

1. Buka request di **Postman**
2. Pilih tab **Authorization**
3. Pilih **Type : Bearer Token**
4. Masukkan token pada kolom **Token**

Jika token tidak dikirim atau tidak valid maka request akan ditolak oleh sistem.

---

# Urutan Pengujian

Karena terdapat relasi antar data, maka pengujian harus dilakukan dengan urutan berikut:

1. CRUD Metode Pembayaran
2. CRUD Pembayaran

Pembayaran membutuhkan:

- `penjualanID`
- `metodePembayaranID`

Sehingga **Metode Pembayaran harus dibuat terlebih dahulu**.

---

# 1. Create Metode Pembayaran

### URL

```
POST /metodePembayaran
```

### JSON Request

```
{
  "akunKasID": "AKUN_KAS_ID",
  "namaPembayaran": "Transfer Bank",
  "kategori": "non-tunai"
}
```

### Output Response

```
{
  "data": {
    "_id": "METODE_PEMBAYARAN_ID",
    "tenantID": "TENANT_ID",
    "dataAkunKas": {
      "_id": "AKUN_KAS_ID",
      "namaAkun": "Kas Bank",
      "nomorAkun": "11001"
    },
    "namaPembayaran": "Transfer Bank",
    "kategori": "non-tunai",
    "isAutomated": false,
    "xenditChannelCode": null,
    "isActive": true,
    "createdAt": "2026-03-11T10:00:00.000Z",
    "updatedAt": "2026-03-11T10:00:00.000Z"
  }
}
```

---

# 2. Get All Metode Pembayaran

### URL

```
GET /metodePembayaran
```

### Output Response

```
{
  "data": [
    {
      "_id": "METODE_PEMBAYARAN_ID",
      "tenantID": "TENANT_ID",
      "dataAkunKas": {
        "_id": "AKUN_KAS_ID",
        "namaAkun": "Kas Bank",
        "nomorAkun": "11001"
      },
      "namaPembayaran": "Transfer Bank",
      "kategori": "non-tunai",
      "isAutomated": false,
      "xenditChannelCode": null,
      "isActive": true
    }
  ]
}
```

---

# 3. Get Metode Pembayaran by ID

### URL

```
GET /metodePembayaran/:id
```

### Output Response

```
{
  "data": {
    "_id": "METODE_PEMBAYARAN_ID",
    "tenantID": "TENANT_ID",
    "namaPembayaran": "Transfer Bank",
    "kategori": "non-tunai",
    "isActive": true
  }
}
```

---

# 4. Update Metode Pembayaran

### URL

```
PUT /metodePembayaran/:id
```

### JSON Request

```
{
  "namaPembayaran": "Transfer Bank BCA"
}
```

### Output Response

```
{
  "data": {
    "_id": "METODE_PEMBAYARAN_ID",
    "namaPembayaran": "Transfer Bank BCA",
    "kategori": "non-tunai",
    "isActive": true
  }
}
```

---

# 5. Delete Metode Pembayaran

### URL

```
DELETE /metodePembayaran/:id
```

### Output Response

```
{
  "data": true
}
```

---

# 6. Create Pembayaran

### URL

```
POST /pembayaran
```

### JSON Request

```
{
  "penjualanID": "PENJUALAN_ID",
  "metodePembayaranID": "METODE_PEMBAYARAN_ID",
  "jumlahBayar": 100000
}
```

### Output Response

```
{
  "data": {
    "_id": "PEMBAYARAN_ID",
    "tenantID": "TENANT_ID",
    "penjualanID": "PENJUALAN_ID",
    "metodePembayaranID": "METODE_PEMBAYARAN_ID",
    "jumlahBayar": 100000,
    "status": "PAID",
    "tanggalBayar": "2026-03-11T10:30:00.000Z"
  }
}
```

---

# 7. Get All Pembayaran

### URL

```
GET /pembayaran
```

### Output Response

```
{
  "data": [
    {
      "_id": "PEMBAYARAN_ID",
      "penjualanID": "PENJUALAN_ID",
      "metodePembayaranID": "METODE_PEMBAYARAN_ID",
      "jumlahBayar": 100000,
      "status": "PAID"
    }
  ]
}
```

---

# 8. Get Pembayaran by ID

### URL

```
GET /pembayaran/:id
```

### Output Response

```
{
  "data": {
    "_id": "PEMBAYARAN_ID",
    "penjualanID": "PENJUALAN_ID",
    "metodePembayaranID": "METODE_PEMBAYARAN_ID",
    "jumlahBayar": 100000,
    "status": "PAID"
  }
}
```

---

# 9. Update Pembayaran

### URL

```
PUT /pembayaran/:id
```

### JSON Request

```
{
  "catatan": "Pembayaran melalui transfer bank"
}
```

### Output Response

```
{
  "data": {
    "_id": "PEMBAYARAN_ID",
    "jumlahBayar": 100000,
    "status": "PAID",
    "catatan": "Pembayaran melalui transfer bank"
  }
}
```

---

# 10. Delete Pembayaran

### URL

```
DELETE /pembayaran/:id
```

### Output Response

```
{
  "data": true
}
```

---

# Catatan Penting

Beberapa aturan penting pada sistem pembayaran:

### 1. Pembayaran tidak boleh melebihi sisa tagihan
Jika jumlah bayar melebihi sisa tagihan maka sistem akan menolak request.

### 2. Jika penjualan sudah lunas
Maka pembayaran baru tidak dapat ditambahkan.

### 3. Status pembayaran otomatis

Metode pembayaran:

- **Manual → status otomatis PAID**
- **Automated (Gateway) → status PENDING**

### 4. Tanggal pembayaran

Tanggal pembayaran tidak boleh:

- lebih awal dari tanggal transaksi penjualan
- lebih dari **3 bulan ke belakang**
- berada di masa depan