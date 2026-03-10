# Dokumentasi API Penjualan

## 1. Mendaftarkan Permission Penjualan

Untuk melindungi gerbang kasir (POS) dan Faktur, buatlah Permission khusus untuk fungsi Penjualan.

**URL Tujuan:** `POST /api/permissions`

**Body JSON Request:**
```json
{
  "namaPermission": "Akses Kasir Penjualan",
  "deskripsi": "Mengizinkan pengguna untuk melangsungkan transaksi jual beli kasir dan invoice, serta meninjau riwayat transaksi."
}
```

---

## 2. Pengetesan CRUD Penjualan (Postman / Insomnia)

Diperlukan Header: `Authorization: Bearer <token_anda>`.
Endpoint basis: `/api/penjualan`

### A. CREATE Penjualan (Membuat Struk / Pesanan)
Membuat keranjang nota baru. Anda harus menyediakan setidaknya satu *itemPenjualan*.

**Method:** `POST`
**URL:** `/api/penjualan`
**Body JSON:**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1111",
  "noReferensi": "INV-202410-001",
  "penggunaID": "64efc9d1a3b8c6e2a84d2222",
  "pelangganID": "64efc9d1a3b8c6e2a84d3333",
  "jenisTransaksi": "POS",
  "jenisPenjualan": "dine-in",
  "tanggalTransaksi": "2024-10-25T10:00:00.000Z",
  "itemPenjualan": [
    {
      "produkID": "64efc9d1a3b8c6e2a84d4444",
      "namaProduk": "Nasi Goreng Spesial",
      "jumlah": 2,
      "hargaJual": 25000,
      "subTotal": 50000,
      "jumlahDiskon": 0,
      "totalharga": 50000
    }
  ],
  "jumlahDiskonTransaksi": 0,
  "jumlahPajakTransaksi": 5000,
  "totalDibayar": 55000,
  "keterangan": "Tidak pakai pedas"
}
```
*Catatan: Kalkulasi detail (`totalTagihan`, `sisaTagihan`, `statusBayar`) biasanya otomatis dipijak oleh `pre-validate` di Model saat disave.*

### B. READ All
Lihat log catatan riwayat penjualan toko.

**Method:** `GET`
**URL:** `/api/penjualan`

### C. READ By ID
Buka satu lembar nota yang dicetak kasir.

**Method:** `GET`
**URL:** `/api/penjualan/:id` 

### D. UPDATE Penjualan
Bila suatu Invoice belum dibayar (`DRAFT` / `UNPAID`), admin bisa memperbarui produk atau menambah jumlah uang setor `totalDibayar` sebelum benar-benar lunas.

**Method:** `PUT`
**URL:** `/api/penjualan/:id`
**Body JSON:**
```json
{
  "totalDibayar": 55000,
  "statusPenjualan": "FINAL"
}
```

### E. DELETE Penjualan
Memusnahkan sebuah log nota (*Warning:* Akan menghapus bukti keuangan!).

**Method:** `DELETE`
**URL:** `/api/penjualan/:id`
