# 🟡 Integration Test — API Endpoints

> **Tujuan**: Menguji interaksi controller + model + database in-memory secara end-to-end per endpoint.  
> **Tool**: Jest + Supertest + MongoDB Memory Server.  
> **File lokasi**: `__tests__/integration/`

### Setup Supertest

```js
const request = require("supertest");
const app = require("../../app");
```

---

## 2.1 Auth — Registrasi & Login Akun Owner

**File**: `__tests__/integration/auth.test.js`

### ✅ A: Registrasi akun baru berhasil

```js
test("POST /api/akun/auth/register — berhasil buat akun baru", async () => {
  const res = await request(app)
    .post("/api/akun/auth/register")
    .send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      username: "owner_kafe",
    });

  expect(res.statusCode).toBe(201);
  expect(res.body.message).toBe("Registrasi berhasil");
  expect(res.body.data).toHaveProperty("email", "owner@kafemurah.com");
  expect(res.body.data).not.toHaveProperty("password");
});
```

### ❌ B: Registrasi email duplikat harus gagal

```
POST /api/akun/auth/register
```

Expected `HTTP 400`:
```json
{ "message": "Data 'email' sudah digunakan. Harap gunakan yang lain." }
```

### ✅ C: Login berhasil mendapat accessToken

```js
test("POST /api/akun/auth/login — berhasil dapat token", async () => {
  const res = await request(app)
    .post("/api/akun/auth/login")
    .send({
      email: "owner@kafemurah.com",
      password: "Password123!",
      deviceID: "device-laptop-001",
    });

  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty("accessToken");
  expect(res.body.data).toHaveProperty("email", "owner@kafemurah.com");
});
```

### ❌ D: Login tanpa deviceID harus ditolak

Expected `HTTP 400`:
```json
{ "message": "Email, Password, dan Device ID wajib diisi." }
```

### ❌ E: Login dengan password salah harus ditolak

```js
test("POST /api/akun/auth/login — password salah harus 401", async () => {
  const res = await request(app)
    .post("/api/akun/auth/login")
    .send({
      email: "owner@kafemurah.com",
      password: "PasswordSalah!",
      deviceID: "device-001",
    });
  expect(res.statusCode).toBe(401);
});
```

### ✅ F: Refresh token menghasilkan accessToken baru

```js
test("POST /api/akun/auth/refresh-token — berhasil refresh", async () => {
  // Gunakan refreshToken dari login sebelumnya (via cookie)
  const res = await request(app)
    .post("/api/akun/auth/refresh-token")
    .set("Cookie", `refreshToken=${refreshToken}`);

  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty("accessToken");
});
```

---

## 2.2 Produk — CRUD

**File**: `__tests__/integration/produk.test.js`

> **Prerequisite**: Harus punya token `authPengguna` dari login PIN kasir.

### ✅ A: Buat produk baru

```js
test("POST /api/produk — berhasil buat produk baru", async () => {
  const res = await request(app)
    .post("/api/produk")
    .set("Authorization", `Bearer ${penggunaToken}`)
    .send({
      namaProduk: "Es Kopi Susu",
      hargaDasar: 12000,
      hargaJual: 22000,
      kategoriID: kategoriId,
      stok: 50,
    });

  expect(res.statusCode).toBe(201);
  expect(res.body.data).toHaveProperty("namaProduk", "Es Kopi Susu");
  expect(res.body.data.tenantID.toString()).toBe(tenantId.toString());
});
```

### ❌ B: Nama produk duplikat dalam satu tenant harus gagal

Expected `HTTP 400`:
```json
{ "message": "Data 'namaProduk' sudah digunakan. Harap gunakan yang lain." }
```

### ✅ C: GET produk hanya menampilkan milik tenant sendiri

```js
test("GET /api/produk — hanya milik tenant sendiri", async () => {
  const res = await request(app)
    .get("/api/produk")
    .set("Authorization", `Bearer ${penggunaToken}`);

  expect(res.statusCode).toBe(200);
  res.body.data.forEach((produk) => {
    expect(produk.tenantID.toString()).toBe(tenantId.toString());
  });
});
```

### ✅ D: Update produk berhasil

```js
test("PUT /api/produk/:id — berhasil update harga", async () => {
  const res = await request(app)
    .put(`/api/produk/${produkId}`)
    .set("Authorization", `Bearer ${penggunaToken}`)
    .send({ hargaJual: 25000 });

  expect(res.statusCode).toBe(200);
  expect(res.body.data.hargaJual).toBe(25000);
});
```

### ❌ E: Akses produk tenant lain harus 404

```js
test("GET /api/produk/:id — produk tenant lain harus 404", async () => {
  const res = await request(app)
    .get(`/api/produk/${produkTenantLainId}`)
    .set("Authorization", `Bearer ${penggunaToken}`);

  expect(res.statusCode).toBe(404);
});
```

---

## 2.3 Diskon

**File**: `__tests__/integration/diskon.test.js`

### ✅ A: Buat diskon persen per item

```
POST /api/diskon
Authorization: Bearer <pengguna_token> (butuh permission kelola-diskon)
```

```json
{
  "namaDiskon": "Diskon Member 10%",
  "cakupan": "Item",
  "tipe": "persen",
  "nilai": 10,
  "bisaDigabung": false,
  "status": "Aktif"
}
```

Expected `HTTP 201` + data diskon tersimpan dengan `tenantID` otomatis.

### ❌ B: Diskon persen > 100 harus ditolak

Expected `HTTP 400`:
```json
{
  "message": "Data yang dikirim tidak valid.",
  "errors": ["Diskon bertipe persen tidak boleh melebihi 100"]
}
```

### ❌ C: Akses tanpa permission `kelola-diskon` harus ditolak

Expected `HTTP 403`:
```json
{ "message": "Anda tidak memiliki akses kelola diskon" }
```

### ✅ D: Update status diskon menjadi Non-Aktif

```js
test("PUT /api/diskon/:id — update status ke Non-Aktif", async () => {
  const res = await request(app)
    .put(`/api/diskon/${diskonId}`)
    .set("Authorization", `Bearer ${penggunaToken}`)
    .send({ status: "Non-Aktif" });

  expect(res.statusCode).toBe(200);
  expect(res.body.data.status).toBe("Non-Aktif");
});
```

---

## 2.4 Penjualan — Membuat Transaksi

**File**: `__tests__/integration/penjualan.test.js`

### ✅ A: Transaksi POS dine-in berhasil dibuat

```js
test("POST /api/penjualan — transaksi dine-in UNPAID", async () => {
  const res = await request(app)
    .post("/api/penjualan")
    .set("Authorization", `Bearer ${penggunaToken}`)
    .send({
      noReferensi: "POS-20260324-001",
      jenisTransaksi: "POS",
      jenisPenjualan: "dine-in",
      tanggalTransaksi: new Date().toISOString(),
      itemPenjualan: [{
        produkID: produkId,
        namaProduk: "Es Kopi Susu",
        jumlah: 2,
        hargaJual: 22000,
        subTotal: 44000,
        jumlahDiskon: 0,
        total: 44000,
        jumlahPajak: 0,
        totalharga: 44000,
      }],
      jumlahDiskonTransaksi: 0,
      jumlahPajakTransaksi: 0,
      totalDibayar: 0,
    });

  expect(res.statusCode).toBe(201);
  expect(res.body.data.statusBayar).toBe("UNPAID");
  expect(res.body.data.totalTagihan).toBe(44000);
  expect(res.body.data.tenantID.toString()).toBe(tenantId.toString());
});
```

### ✅ B: Transaksi dengan diskon global → totalTagihan berkurang

Expected response:
```json
{
  "data": {
    "totalHargaProduk": 66000,
    "jumlahDiskonTransaksi": 10000,
    "totalTagihan": 56000,
    "statusBayar": "PAID"
  }
}
```

### ❌ C: noReferensi duplikat dalam satu tenant harus gagal

Expected `HTTP 400`:
```json
{ "message": "Data 'noReferensi' sudah digunakan. Harap gunakan yang lain." }
```

### ✅ D: GET penjualan hanya menampilkan milik tenant sendiri

```js
test("GET /api/penjualan — hanya milik tenant sendiri", async () => {
  const res = await request(app)
    .get("/api/penjualan")
    .set("Authorization", `Bearer ${penggunaToken}`);

  res.body.data.forEach((p) => {
    expect(p.tenantID.toString()).toBe(tenantId.toString());
  });
});
```

---

## 2.5 Pembayaran

**File**: `__tests__/integration/pembayaran.test.js`

### ✅ A: Rekam pembayaran lunas

```
POST /api/pembayaran
Authorization: Bearer <pengguna_token> (butuh kelola-pembayaran)
```

```json
{
  "penjualanID": "<id>",
  "akunKasID": "<id>",
  "metodePembayaranID": "<id>",
  "noReferensi": "PAY-001",
  "jumlahBayar": 79000,
  "tanggalBayar": "2026-03-24T07:45:00.000Z",
  "status": "PAID"
}
```

Expected `HTTP 201` + `status: "PAID"`.

### ❌ B: Status PAID tanpa tanggalBayar harus ditolak

Expected `HTTP 400`:
```json
{
  "message": "Data yang dikirim tidak valid.",
  "errors": ["Tanggal bayar wajib diisi jika status PAID"]
}
```

### ✅ C: Pembayaran berhasil mengupdate statusBayar penjualan menjadi PAID

```js
test("Pembayaran lunas mengupdate penjualan → PAID", async () => {
  await request(app)
    .post("/api/pembayaran")
    .set("Authorization", `Bearer ${penggunaToken}`)
    .send({ /* payload lengkap */ });

  const cekPenjualan = await request(app)
    .get(`/api/penjualan/${penjualanId}`)
    .set("Authorization", `Bearer ${penggunaToken}`);

  expect(cekPenjualan.body.data.statusBayar).toBe("PAID");
  expect(cekPenjualan.body.data.sisaTagihan).toBe(0);
});
```

### ❌ D: jumlahBayar negatif harus ditolak

Expected `HTTP 400`.
