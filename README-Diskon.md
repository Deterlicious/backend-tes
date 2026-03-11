# Diskon API

Dokumentasi ini menjelaskan cara melakukan **pengujian CRUD Diskon** menggunakan Postman.

Fitur diskon digunakan untuk memberikan potongan harga pada transaksi penjualan.

Diskon dapat digunakan pada:

- **Item Penjualan**
- **Total Transaksi**

---

# Permission yang Dibutuhkan

Fitur ini membutuhkan permission berikut:

```
kelola-diskon
```

Permission ini memberikan akses untuk:

- Melihat daftar diskon
- Melihat detail diskon
- Membuat diskon
- Mengubah diskon
- Menghapus diskon

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

# Jenis Diskon

Pada sistem terdapat dua jenis cakupan diskon.

### Diskon Global

Diskon yang diterapkan pada **total transaksi**.

Contoh penggunaan:

```
Total transaksi: 100000
Diskon global: 10%
Total setelah diskon: 90000
```

---

### Diskon Item

Diskon yang diterapkan pada **item tertentu**.

Contoh penggunaan:

```
Produk: Kopi
Harga: 20000
Diskon item: 10%
Total item: 18000
```

---

# Tipe Diskon

Diskon memiliki dua tipe nilai.

### Diskon Persen

Diskon dihitung berdasarkan persentase.

Contoh:

```
Harga produk: 100000
Diskon: 10%
Potongan: 10000
Total: 90000
```

Nilai diskon persen **tidak boleh lebih dari 100**.

---

### Diskon Nominal

Diskon berupa potongan harga langsung.

Contoh:

```
Harga produk: 100000
Diskon: 20000
Total: 80000
```

---

# Kombinasi Diskon

Diskon memiliki field:

```
bisaDigabung
```

Jika:

```
bisaDigabung = false
```

Maka diskon **tidak boleh digunakan bersamaan dengan diskon lain**.

Jika:

```
bisaDigabung = true
```

Maka diskon **boleh digabung dengan diskon lain**.

---

# 1. Create Diskon

Digunakan untuk membuat diskon baru.

**URL**

```
POST /diskon
```

---

## Body Request

```json
{
  "namaDiskon": "Diskon Member",
  "cakupan": "Global",
  "tipe": "persen",
  "nilai": 10,
  "bisaDigabung": true,
  "status": "Aktif"
}
```

---

## Contoh Diskon Item

```json
{
  "namaDiskon": "Diskon Kopi",
  "cakupan": "Item",
  "tipe": "nominal",
  "nilai": 5000,
  "bisaDigabung": false,
  "status": "Aktif"
}
```

---

## Response

```json
{
  "data": {
    "_id": "DISKON_ID",
    "tenantID": "TENANT_ID",
    "namaDiskon": "Diskon Member",
    "cakupan": "Global",
    "tipe": "persen",
    "nilai": 10,
    "bisaDigabung": true,
    "status": "Aktif",
    "createdAt": "2026-03-12T10:00:00.000Z",
    "updatedAt": "2026-03-12T10:00:00.000Z"
  }
}
```

---

# 2. Get Semua Diskon

Digunakan untuk melihat seluruh data diskon.

**URL**

```
GET /diskon
```

---

## Filter Diskon

Endpoint ini mendukung filter berikut:

### Filter Status

```
GET /diskon?status=Aktif
```

---

### Filter Cakupan

```
GET /diskon?cakupan=Global
```

atau

```
GET /diskon?cakupan=Item
```

---

### Filter Tipe

```
GET /diskon?tipe=persen
```

atau

```
GET /diskon?tipe=nominal
```

---

## Response

```json
{
  "data": [
    {
      "_id": "DISKON_ID",
      "namaDiskon": "Diskon Member",
      "cakupan": "Global",
      "tipe": "persen",
      "nilai": 10,
      "bisaDigabung": true,
      "status": "Aktif"
    }
  ]
}
```

---

# 3. Get Diskon by ID

Digunakan untuk melihat detail diskon.

**URL**

```
GET /diskon/{id}
```

---

## Response

```json
{
  "data": {
    "_id": "DISKON_ID",
    "namaDiskon": "Diskon Member",
    "cakupan": "Global",
    "tipe": "persen",
    "nilai": 10,
    "bisaDigabung": true,
    "status": "Aktif"
  }
}
```

---

# 4. Update Diskon

Digunakan untuk mengubah data diskon.

**URL**

```
PUT /diskon/{id}
```

---

## Body Request

```json
{
  "namaDiskon": "Diskon Member Baru",
  "nilai": 15
}
```

---

## Response

```json
{
  "data": {
    "_id": "DISKON_ID",
    "namaDiskon": "Diskon Member Baru",
    "cakupan": "Global",
    "tipe": "persen",
    "nilai": 15,
    "bisaDigabung": true,
    "status": "Aktif"
  }
}
```

---

# 5. Delete Diskon

Digunakan untuk menghapus diskon.

**URL**

```
DELETE /diskon/{id}
```

---

## Response

```json
{
  "data": true
}
```

---

# Catatan Penting

Diskon akan ditolak jika:

- namaDiskon kosong
- nilai diskon negatif
- nilai diskon persen lebih dari 100
- cakupan tidak valid
- tipe diskon tidak valid

Selain itu:

- nama diskon harus **unik dalam satu tenant**
- diskon hanya bisa digunakan jika status **Aktif**

Contoh error:

```json
{
  "errors": [
    "Nama diskon sudah digunakan di tenant ini"
  ]
}
```