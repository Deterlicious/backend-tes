# 📖 Panduan Santai Postman: Alur Akun, Tenant, Role, Pengguna & Permission

Halo! Ini adalah panduan pengetesan API lewat Postman. Semua URL dan field body JSON sudah disesuaikan langsung dari kode validator dan controller aplikasinya.

> **Info Penting:** `deviceID` pada saat login akun adalah **wajib** karena sistem mencatat riwayat perangkat.

Ada 2 skenario utama:
1. **Skenario 1**: Mulai dari nol (Bikin Akun Baru & Setup Tenant)
2. **Skenario 2**: Kalau datanya udah ada (Akun Lama)

---

## 🛠 Langkah 0: Seeding Permission (Wajib, via Terminal)
Sebelum dites di Postman, pastikan di database udah ada list "hak akses". **Jangan pakai Postman untuk langkah ini!**

Buka Terminal/Command Prompt di folder backend kamu, lalu jalankan:
```bash
node seeds/permissionSeed.js
```
Tunggu hingga muncul pesan sukses di terminal, baru lanjut ke Postman.

---

## 🟢 Skenario 1: Mulai Dari Nol (Workflow Akun Baru)

### 1. Bikin Akun Induk (Register)
Daftarin institusi/perusahaan ke sistem terlebih dahulu.
- **URL Postman:** `POST http://localhost:4000/api/auth/register`
- **Body JSON** *(field wajib: `email`, `password`)*:
```json
{
  "email": "admin@sukses.com",
  "password": "passwordKuat123"
}
```

### 2. Login Akun Induk
Setelah daftar, login pakai kredensial tadi.
- **URL Postman:** `POST http://localhost:4000/api/auth/login`
- **Body JSON** *(field wajib: `email`, `password`, `deviceID`)*:
```json
{
  "email": "admin@sukses.com",
  "password": "passwordKuat123",
  "deviceID": "device-postman-001"
}
```
- **Penjelasan Access Token:** Dari sini kamu bakal dapet **Access Token Akun**. Simpan token ini (misal `{{token_akun}}`) karena dipakai untuk membuat Tenant di langkah berikutnya.

### 3. Bikin Tenant (Toko/Cabang)
Pakai token akun tadi untuk mendaftarkan toko/cabang baru.
- **URL Postman:** `POST http://localhost:4000/api/tenant`
- **Headers:** `Authorization: Bearer {{token_akun}}`
- **Body JSON** *(field wajib: `namaToko`)*:
```json
{
  "namaToko": "Toko Cabang Jakarta"
}
```
- **Penjelasan Access Token:** Setelah tenant berhasil dibuat, sistem otomatis membalikin **Access Token Tenant** di response. Ambil dan simpan token baru ini (misal `{{token_tenant}}`). Token ini khusus dipakai untuk mendaftarkan Owner toko.

### 4. Bikin Pengguna Sebagai "Owner" Toko
Pakai `{{token_tenant}}` untuk mendaftarkan pemilik/bos toko. Cukup nama dan PIN.
- **URL Postman:** `POST http://localhost:4000/api/pengguna/register-owner`
- **Headers:** `Authorization: Bearer {{token_tenant}}`
- **Body JSON** *(field wajib: `nama`, `pin`)*:
```json
{
  "nama": "Bapak Owner",
  "pin": "123456"
}
```
  > `tenantID` **tidak perlu dikirim** di body — sistem sudah mengambilnya otomatis dari Access Token Tenant yang kamu pakai di Header.
- **Penjelasan Access Token:** Begitu Owner berhasil dibuat, sistem langsung memberikan **Access Token Owner** di response — tanpa perlu login pengguna secara terpisah. Ibarat kata, dia otomatis sudah masuk. Simpan token ini (misal `{{token_owner}}`) untuk langkah selanjutnya.

### 5. Lihat Daftar Permission (Untuk Ambil ID-nya)
Sebelum bikin role, kamu perlu tahu ID dari permission-permission yang ada.
- **URL Postman:** `GET http://localhost:4000/api/permission`
- **Headers:** `Authorization: Bearer {{token_owner}}`
- **Body JSON:** *(tidak perlu)*
- Dari response, catat `_id` dari permission-permission yang ingin dimasukkan ke role.

### 6. Owner Bikin Role (Sekalian Kasih Permission)
Buat jabatan/role sekaligus tentukan hak aksesnya dalam satu request.
- **URL Postman:** `POST http://localhost:4000/api/role`
- **Headers:** `Authorization: Bearer {{token_owner}}`
- **Body JSON** *(field wajib: `namaRole`)*:
```json
{
  "namaRole": "Kasir",
  "permissions": ["id_permission_1", "id_permission_2"]
}
```
  > Isi array `permissions` dengan `_id` permission dari langkah #5 di atas, bukan namanya.
- **Penjelasan:** Catat `_id` role yang ada di response (misal `{{roleID}}`).

### 7. Owner Bikin Akun Staf
Rekrut karyawan baru dengan role yang sudah dibuat.
- **URL Postman:** `POST http://localhost:4000/api/pengguna/register-pengguna`
- **Headers:** `Authorization: Bearer {{token_owner}}`
- **Body JSON** *(field wajib: `nama`, `pin`, `roleID`)*:
```json
{
  "nama": "Siti Kasir",
  "pin": "654321",
  "roleID": "{{roleID}}"
}
```
  > `tenantID` **tidak perlu dikirim** di body — sistem sudah mengambilnya otomatis dari Access Token Owner yang kamu pakai di Header.
- Sip! Skenario 1 selesai. Siti Kasir sudah punya akun dan siap login kapan saja.

---

## 🔵 Skenario 2: Kalau Datanya Udah Ada (Akun Lama)

### 1. Login Akun Pusat (Bila Mau Urus Hal Level Induk)
Kalau yang masuk adalah pemegang **Akun Induk/Perusahaan**:
- **URL Postman:** `POST http://localhost:4000/api/auth/login`
- **Body JSON** *(field wajib: `email`, `password`, `deviceID`)*:
```json
{
  "email": "admin@sukses.com",
  "password": "passwordKuat123",
  "deviceID": "device-postman-001"
}
```
- **Penjelasan Access Token:** Kamu dapat kembali **Access Token Akun** untuk urusan admin pusat, misalnya membuka cabang/tenant baru.

### 2. Login Pengguna (Bila Karyawan atau Owner Toko Mau Mulai Kerja)
Kalau si Owner atau Siti Kasir mau masuk system (misalnya shift pagi):
- **URL Postman:** `POST http://localhost:4000/api/pengguna/pin-login`
- **Headers:** `Authorization: Bearer {{token_akun}}`
- **Body JSON** *(field wajib: `nama`, `pin`)*:
```json
{
  "nama": "Siti Kasir",
  "pin": "654321"
}
```
- **Penjelasan Access Token:** Sistem akan membalas dengan **Access Token Pengguna**. Token ini bukan cuma buat transaksi harian — kalau pengguna tersebut punya role dengan permission tinggi (seperti Owner), token ini juga bisa dipakai untuk **bikin pengguna baru** dan **bikin role baru** di dalam toko tersebut.

---

Selamat mencoba! 🚀
