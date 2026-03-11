# Penjualan API

Dokumentasi ini menjelaskan cara melakukan **pengujian CRUD Penjualan** menggunakan Postman.

Fitur penjualan digunakan untuk membuat transaksi penjualan produk secara langsung.

Penjualan memiliki keterkaitan dengan beberapa data berikut:

- **Produk**
- **Pelanggan**
- **Diskon**
- **Pajak**
- **Sesi Booking** (jika jenis penjualan booking)

---

# Permission yang Dibutuhkan

Fitur ini membutuhkan permission berikut:

```
kelola-penjualan
```

Permission ini memberikan akses untuk:

- Melihat daftar penjualan
- Melihat detail penjualan
- Membuat penjualan
- Mengubah penjualan
- Menghapus penjualan

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

# Pengujian Penjualan

Pada saat membuat penjualan, sistem akan otomatis:

- mengambil data produk
- menghitung subtotal item
- menghitung diskon item
- menghitung pajak item
- menghitung diskon global
- menghitung pajak transaksi
- menghitung total tagihan
- menentukan status pembayaran

---

# Diskon pada Penjualan

Pada penjualan, sistem mendukung penggunaan diskon.

Terdapat dua jenis diskon yang dapat digunakan:

### Diskon Item

Diskon yang diterapkan pada masing-masing item penjualan.

Field yang digunakan:

```
diskonItem
```

Contoh:

```json
"diskonItem": ["DISKON_ITEM_ID"]
```

---

### Diskon Global

Diskon yang diterapkan pada total transaksi.

Field yang digunakan:

```
diskonGlobal
```

Contoh:

```json
"diskonGlobal": ["DISKON_GLOBAL_ID"]
```

---

# Pajak pada Penjualan

Pada penjualan, sistem juga akan menghitung pajak:

- **Pajak per item**
- **Pajak per transaksi**

Pajak transaksi akan diambil otomatis dari data pajak yang aktif dengan tipe:

```
Per Transaksi
```

Sehingga pada saat melakukan pengujian penjualan, Anda tidak perlu menghitung pajak secara manual karena sistem akan menghitungnya secara otomatis.

---

# 1. Create Penjualan

Digunakan untuk membuat transaksi penjualan baru.

**URL**

```
POST /penjualan
```

---

## Body Request

```json
{
  "pelangganID": "PELANGGAN_ID",
  "jenisTransaksi": "POS",
  "jenisPenjualan": "dine-in",
  "tanggalTransaksi": "2026-03-12T10:00:00.000Z",
  "itemPenjualan": [
    {
      "produkID": "PRODUK_ID",
      "jumlah": 2
    }
  ]
}
```

---

## Create Penjualan dengan Diskon

```json
{
  "pelangganID": "PELANGGAN_ID",
  "jenisTransaksi": "POS",
  "jenisPenjualan": "takeaway",
  "tanggalTransaksi": "2026-03-12T10:00:00.000Z",
  "diskonGlobal": ["DISKON_GLOBAL_ID"],
  "itemPenjualan": [
    {
      "produkID": "PRODUK_ID",
      "jumlah": 2,
      "diskonItem": ["DISKON_ITEM_ID"]
    }
  ]
}
```

---

## Create Penjualan Draft

Jika ingin menyimpan penjualan sebagai draft.

```json
{
  "pelangganID": "PELANGGAN_ID",
  "jenisTransaksi": "POS",
  "jenisPenjualan": "dine-in",
  "tanggalTransaksi": "2026-03-12T10:00:00.000Z",
  "simpanDraft": true,
  "itemPenjualan": [
    {
      "produkID": "PRODUK_ID",
      "jumlah": 1
    }
  ]
}
```

---

## Response

```json
{
  "data": {
    "_id": "PENJUALAN_ID",
    "tenantID": "TENANT_ID",
    "noReferensi": "POS/TKA/20260312/100000001",
    "dataPengguna": {
      "_id": "PENGGUNA_ID",
      "nama": "Admin"
    },
    "dataPelanggan": {
      "_id": "PELANGGAN_ID",
      "namaPelanggan": "Siti"
    },
    "jenisTransaksi": "POS",
    "jenisPenjualan": "dine-in",
    "tanggalTransaksi": "2026-03-12T10:00:00.000Z",
    "itemPenjualan": [
      {
        "sesiBookingID": null,
        "produkID": "PRODUK_ID",
        "namaProduk": "Es Teh",
        "jumlah": 2,
        "hargaJual": 5000,
        "subTotal": 10000,
        "diskonItem": [],
        "jumlahDiskon": 0,
        "total": 10000,
        "rincianPajak": [],
        "jumlahPajak": 0,
        "totalharga": 10000
      }
    ],
    "totalHargaProduk": 10000,
    "diskonGlobal": [],
    "jumlahDiskonTransaksi": 0,
    "pajakTransaksi": [],
    "jumlahPajakTransaksi": 0,
    "totalTagihan": 10000,
    "totalDibayar": 0,
    "sisaTagihan": 10000,
    "statusBayar": "UNPAID",
    "keterangan": "",
    "statusPenjualan": "FINAL"
  }
}
```

---

# 2. Get Semua Penjualan

Digunakan untuk melihat seluruh data penjualan.

**URL**

```
GET /penjualan
```

---

## Filter Penjualan

Endpoint ini mendukung filter berikut:

- `statusBayar`
- `statusPenjualan`
- `jenisTransaksi`
- `jenisPenjualan`
- `pelangganID`
- `startDate`
- `endDate`
- `noReferensi`

Contoh:

```
GET /penjualan?statusBayar=UNPAID
```

Contoh:

```
GET /penjualan?statusPenjualan=DRAFT
```

Contoh:

```
GET /penjualan?jenisTransaksi=POS&jenisPenjualan=dine-in
```

Contoh:

```
GET /penjualan?startDate=2026-03-01&endDate=2026-03-31
```

---

# 3. Get Penjualan by ID

Digunakan untuk melihat detail penjualan.

**URL**

```
GET /penjualan/{id}
```

---

# 4. Update Penjualan

Digunakan untuk mengubah data penjualan.

**URL**

```
PUT /penjualan/{id}
```

Contoh:

```json
{
  "itemPenjualan": [
    {
      "produkID": "PRODUK_ID",
      "jumlah": 3
    }
  ]
}
```

---

## Finalize Penjualan Draft

Jika penjualan masih berstatus `DRAFT`, Anda bisa mengubah menjadi `FINAL` dengan:

```json
{
  "finalize": true
}
```

---

# 5. Delete Penjualan

Digunakan untuk menghapus penjualan.

**URL**

```
DELETE /penjualan/{id}
```

**Response**

```json
{
  "data": true
}
```

---

# Catatan Penting

Penjualan akan ditolak jika:

- produk tidak ditemukan
- pelanggan tidak valid
- kombinasi diskon tidak valid
- diskon tidak aktif
- pajak transaksi tidak valid
- item penjualan kosong

Selain itu:

- penjualan dengan status `FINAL` tidak bisa diubah
- penjualan dengan status `FINAL` tidak bisa dihapus