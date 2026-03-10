# Dokumentasi API Sesi Booking

## 1. Mendaftarkan Permission Sesi Booking

Sebelum Anda bisa mengakses endpoint `sesi-booking`, Anda perlu memberikan akses (permissions) kepada Role pengguna via modul `Permission` dan lalu menetapkannya di `RolePermission`, atau Anda cukup menggunakan Role Admin Super.

Jika Anda membuat permission baru di database, Anda bisa menembak API `POST /api/permissions`.

**URL Tujuan:** `POST /api/permissions`

**Body JSON Request:**
```json
{
  "namaPermission": "Kelola Sesi Booking",
  "deskripsi": "Mengizinkan pengguna untuk membuat, membaca, mengubah, dan menghapus sesi booking aset."
}
```

---

## 2. Pengetesan CRUD Sesi Booking (Postman / Insomnia)

Pastikan di headers HTTP Anda sudah menyertakan Token Autoritas:
`Authorization: Bearer <token_anda>`
Semua endpoint di bawah ini diakses di URL root: `http://localhost:5000/api/sesi-booking` (Sesuaikan port dan penamaan rute server lokal Anda).

### A. CREATE Sesi Booking (Memulai Pemakaian)
Membuka sesi penyewaan baru. `waktuMulai` akan tercatat.

**Method:** `POST`
**URL:** `/api/sesi-booking`
**Body JSON:**
```json
{
  "tenantID": "64efc9d1a3b8c6e2a84d1234",
  "dataPengguna": "64efc9d1a3b8c6e2a84d5678",
  "dataPelanggan": "64efc9d1a3b8c6e2a84d9012",
  "dataAset": "64efc9d1a3b8c6e2a84d3456",
  "dataPenjualan": "64efc9d1a3b8c6e2a84d7890",
  "dataTarif": "64efc9d1a3b8c6e2a84d2345",
  "waktuMulai": "2024-10-25T14:30:00.000Z",
  "status": "Aktif"
}
```
*(Ganti ID ObjectID Mongoose di atas sesuai referensi data sebenarnya di database Anda)*

### B. READ All / List
Mendapatkan semua riwayat transaksi penyewaan (mendukung query filter jika disokong oleh Controller-nya).

**Method:** `GET`
**URL:** `/api/sesi-booking`

### C. READ By ID
Melihat satu lembar spesifik sesi rent.

**Method:** `GET`
**URL:** `/api/sesi-booking/:id` (Ganti `:id` dengan ID transaksi di respon POST)

### D. UPDATE Sesi Booking (Menutup Pemakaian / Checkout)
Sering dipakai saat aset selesai dipakai, kita _inject_ variabel `waktuSelesai`. (Mongoose model otomatis menghitung `durasiMenit` berkat `pre-save`).

**Method:** `PUT`
**URL:** `/api/sesi-booking/:id`
**Body JSON:**
```json
{
  "waktuSelesai": "2024-10-25T15:30:00.000Z",
  "status": "Selesai"
}
```

### E. DELETE Sesi Booking
Menghapus riwayat transaksi penyewaan jika salah input (Bukan untuk membatalkan!).

**Method:** `DELETE`
**URL:** `/api/sesi-booking/:id`
