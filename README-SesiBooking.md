# Sesi Booking API

Dokumentasi ini menjelaskan cara melakukan **pengujian CRUD Sesi Booking** menggunakan Postman.

Fitur booking digunakan untuk melakukan **penyewaan aset pada waktu tertentu**.

Booking memiliki keterkaitan dengan beberapa data berikut:

- **Aset**
- **Pelanggan**
- **Tarif**
- **Diskon**
- **Penjualan**

---

# Permission yang Dibutuhkan

Fitur ini membutuhkan permission berikut:

```
kelola-booking
```

Permission ini memberikan akses untuk:

- Melihat daftar booking
- Melihat detail booking
- Membuat booking
- Mengubah booking
- Menghapus booking

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

# Pengujian Booking

Booking akan otomatis:

- menghitung **durasi penggunaan aset**
- menghitung **harga berdasarkan tarif**
- menghitung **diskon jika digunakan**
- menghitung **pajak**
- membuat **data penjualan otomatis**

---

# Diskon pada Booking

Pada saat membuat booking, sistem mendukung penggunaan diskon.

Terdapat dua jenis diskon yang dapat digunakan:

### Diskon Item

Diskon yang diterapkan pada **item booking**.

Field yang digunakan:

```
diskonItem
```

Contoh:

```
"diskonItem": ["DISKON_ID"]
```

---

### Diskon Global

Diskon yang diterapkan pada **total transaksi booking**.

Field yang digunakan:

```
diskonGlobal
```

Contoh:

```
"diskonGlobal": ["DISKON_ID"]
```

---

# 1. Create Booking

Digunakan untuk membuat booking baru.

**URL**

```
POST /sesi-booking
```

**Body**

```json
{
  "dataPelanggan": "PELANGGAN_ID",
  "dataAset": "ASET_ID",
  "dataTarif": "TARIF_ID",
  "waktuMulai": "2026-03-12T10:00:00",
  "waktuSelesai": "2026-03-12T11:00:00"
}
```

---

## Create Booking dengan Diskon

Contoh jika ingin menggunakan diskon.

```json
{
  "dataPelanggan": "PELANGGAN_ID",
  "dataAset": "ASET_ID",
  "dataTarif": "TARIF_ID",
  "waktuMulai": "2026-03-12T10:00:00",
  "waktuSelesai": "2026-03-12T11:00:00",
  "diskonItem": ["DISKON_ITEM_ID"],
  "diskonGlobal": ["DISKON_GLOBAL_ID"]
}
```

---

## Response

```json
{
  "data": {
    "_id": "BOOKING_ID",
    "dataAset": {
      "namaAset": "Lapangan Futsal 1"
    },
    "dataPelanggan": {
      "namaPelanggan": "Siti"
    },
    "waktuMulai": "2026-03-12T10:00:00",
    "waktuSelesai": "2026-03-12T11:00:00",
    "durasiMenit": 60,
    "totalBiaya": 100000,
    "status": "Aktif"
  }
}
```

---

# 2. Get Semua Booking

Digunakan untuk melihat seluruh data booking.

**URL**

```
GET /sesi-booking
```

---

## Filter berdasarkan tanggal

Booking juga dapat difilter berdasarkan tanggal.

```
GET /sesi-booking?tanggal=2026-03-12
```

---

## Response

```json
{
  "data": [
    {
      "_id": "BOOKING_ID",
      "dataAset": {
        "namaAset": "Lapangan Futsal 1"
      },
      "waktuMulai": "2026-03-12T10:00:00",
      "waktuSelesai": "2026-03-12T11:00:00",
      "status": "Aktif"
    }
  ]
}
```

---

# 3. Get Booking by ID

Digunakan untuk melihat detail booking.

**URL**

```
GET /sesi-booking/{id}
```

---

# 4. Update Booking

Digunakan untuk mengubah data booking.

**URL**

```
PUT /sesi-booking/{id}
```

Contoh perubahan waktu:

```json
{
  "waktuMulai": "2026-03-12T12:00:00",
  "waktuSelesai": "2026-03-12T13:00:00"
}
```

Booking akan otomatis:

- menghitung ulang **durasi**
- menghitung ulang **harga**
- menghitung ulang **diskon**
- menghitung ulang **pajak**

---

# 5. Delete Booking

Digunakan untuk menghapus booking.

**URL**

```
DELETE /sesi-booking/{id}
```

Response:

```json
{
  "data": true
}
```

---

# Catatan Penting

Booking akan ditolak jika:

- aset sedang digunakan pada waktu tersebut
- waktu selesai lebih awal dari waktu mulai
- aset bukan milik tenant
- diskon tidak valid

Contoh error:

```json
{
  "errors": [
    "Aset sedang digunakan pada jam tersebut."
  ]
}
```
sekara