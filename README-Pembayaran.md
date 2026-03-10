# Dokumentasi API Pembayaran

## 1. Mendaftarkan Permission Pembayaran

Berikan batasan kepada karyawan mana yang diizinkan untuk menerima konfirmasi setoran (biasanya dipisah antara peran *Waiter* dan *Cashier*).

**URL Tujuan:** `POST /api/permissions`

**Body JSON Request:**
```json
{
  "namaPermission": "Terima Pembayaran",
  "deskripsi": "Memberikan hak bagi staff untuk mengekstrak uang masuk, merilis status lunas, dan mencairkan void payment."
}
```

---

## 2. Pengetesan CRUD Pembayaran (Postman / Insomnia)

Pastikan Header Request memuat `Authorization: Bearer <token_anda>`.
Endpoint umum: `/api/pembayaran`

### A. CREATE Pembayaran (Menyetorkan Uang / Hit API QRIS)
Menyekresi dana ke satu tagihan/Penjualan tertentu. 

**Method:** `POST`
**URL:** `/api/pembayaran`
**Body JSON:**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1234",
  "penjualanID": "64efc9d1a3b8c6e2a84d5678",
  "metodePembayaranID": "64efc9d1a3b8c6e2a84d9012",
  "akunKasID": "64efc9d1a3b8c6e2a84d3456",
  "noReferensi": "INV-202410-001",
  "jumlahBayar": 55000,
  "status": "PAID",
  "tanggalBayar": "2024-10-25T11:00:00.000Z",
  "catatan": "Uang pas dari konsumen"
}
```
*Notes:* Jika status="PAID", `tanggalBayar` **wajib** ada (sesuai verifikasi mongoose model).

### B. READ All
Memperoleh jurnal semua lalu-lintas pembayaran/uang diterima.

**Method:** `GET`
**URL:** `/api/pembayaran`

### C. READ By ID
Melihat kwitansi setoran spesifik (berguna saat ada *dispute* apakah pelanggan sudah transfer atau belum).

**Method:** `GET`
**URL:** `/api/pembayaran/:id` 

### D. UPDATE Pembayaran (Proses Pelunasan Tertunda)
Hal ini rutin dijajal apabila kasir memilih mode Virtual Account yang `status`-nya sebelumnya **`PENDING`**, dan webhook Xendit memicu callback untuk menggantinya jadi **`PAID`**.

**Method:** `PUT`
**URL:** `/api/pembayaran/:id`
**Body JSON:**
```json
{
  "status": "PAID",
  "tanggalBayar": "2024-10-25T11:05:33.000Z",
  "gatewayPaymentID": "qr_12345xcvb"
}
```

### E. DELETE Pembayaran (Void / Batal Setor)
Membatalkan / Merobek bukti setoran (Harap diperhatikan ini tidak membatalkan isi pesanan makanannya (Penjualan), namun murni merevisi transaksional dana!).

**Method:** `DELETE`
**URL:** `/api/pembayaran/:id`
