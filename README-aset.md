# Aset Management API

Dokumentasi ini menjelaskan cara melakukan **pengujian CRUD Aset** menggunakan Postman.

Fitur Aset memiliki ketergantungan pada dua entitas lain:

- **Tipe Aset**
- **Tarif**

---

# Permission yang Dibutuhkan

Fitur ini membutuhkan permission berikut:

```
kelola-aset
```

Permission ini memberikan akses untuk:

- Melihat daftar aset
- Melihat detail aset
- Membuat aset
- Mengubah aset
- Menghapus aset

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

1. CRUD Tipe Aset  
2. CRUD Tarif  
3. CRUD Aset  

Aset membutuhkan `tipeAsetID`, sehingga **Tipe Aset harus dibuat terlebih dahulu**.

---

# 1. Pengujian Tipe Aset

## Create Tipe Aset

**URL**

```
POST /tipe-aset
```

**Body**

```json
{
  "tenantID": "TENANT_ID",
  "namaTipeAset": "Lapangan Futsal"
}
```

**Response**

```json
{
  "data": {
    "_id": "65f1b4a7d8f9a1",
    "tenantID": "TENANT_ID",
    "namaTipeAset": "Lapangan Futsal",
    "deskripsi": null
  }
}
```

---

## Get Semua Tipe Aset

**URL**

```
GET /tipe-aset?tenantID=TENANT_ID
```

**Response**

```json
{
  "data": [
    {
      "_id": "65f1b4a7d8f9a1",
      "tenantID": "TENANT_ID",
      "namaTipeAset": "Lapangan Futsal"
    }
  ]
}
```

---

## Get Tipe Aset by ID

**URL**

```
GET /tipe-aset/{id}?tenantID=TENANT_ID
```

**Response**

```json
{
  "data": {
    "_id": "65f1b4a7d8f9a1",
    "tenantID": "TENANT_ID",
    "namaTipeAset": "Lapangan Futsal"
  }
}
```

---

## Update Tipe Aset

**URL**

```
PUT /tipe-aset/{id}?tenantID=TENANT_ID
```

**Body**

```json
{
  "namaTipeAset": "Lapangan Badminton"
}
```

---

## Delete Tipe Aset

**URL**

```
DELETE /tipe-aset/{id}?tenantID=TENANT_ID
```

---

# 2. Pengujian Tarif

## Create Tarif

**URL**

```
POST /tarif
```

**Body**

```json
{
  "tenantID": "TENANT_ID",
  "namaTarif": "Tarif Siang",
  "basisPerhitungan": "per jam",
  "harga": 100000,
  "durasiMinimum": 1
}
```

**Response**

```json
{
  "data": {
    "_id": "65f1b4a7d8f9a2",
    "namaTarif": "Tarif Siang",
    "basisPerhitungan": "per jam",
    "harga": 100000,
    "durasiMinimum": 1
  }
}
```

---

## Get Semua Tarif

**URL**

```
GET /tarif?tenantID=TENANT_ID
```

**Response**

```json
{
  "data": [
    {
      "_id": "65f1b4a7d8f9a2",
      "namaTarif": "Tarif Siang",
      "harga": 100000
    }
  ]
}
```

---

## Get Tarif by ID

**URL**

```
GET /tarif/{id}?tenantID=TENANT_ID
```

---

## Update Tarif

**URL**

```
PUT /tarif/{id}?tenantID=TENANT_ID
```

**Body**

```json
{
  "harga": 120000
}
```

---

## Delete Tarif

**URL**

```
DELETE /tarif/{id}?tenantID=TENANT_ID
```

---

# 3. Pengujian Aset

## Create Aset

**URL**

```
POST /aset
```

**Body**

```json
{
  "namaAset": "Lapangan Futsal 1",
  "tipeAsetID": "TIPE_ASET_ID"
}
```

**Response**

```json
{
  "data": {
    "_id": "65f1b4a7d8f9a3",
    "namaAset": "Lapangan Futsal 1",
    "status": "tersedia"
  }
}
```

---

## Get Semua Aset

**URL**

```
GET /aset
```

**Response**

```json
{
  "data": [
    {
      "_id": "65f1b4a7d8f9a3",
      "namaAset": "Lapangan Futsal 1",
      "status": "tersedia"
    }
  ]
}
```

---

## Get Aset by ID

**URL**

```
GET /aset/{id}
```

---

## Update Aset

**URL**

```
PUT /aset/{id}
```

**Body**

```json
{
  "status": "perbaikan"
}
```

---

## Delete Aset

**URL**

```
DELETE /aset/{id}
```
