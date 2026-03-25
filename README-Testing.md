# 🧪 Panduan Pengujian Backend — Pyramid Testing

Panduan ini menggunakan pendekatan **Testing Pyramid** untuk memastikan kualitas backend POS multi-tenant secara menyeluruh dan efisien.

```
          ▲
         /E2E\        ← Sedikit, lambat, mahal — full scenario bisnis
        /------\
       / INTEG  \     ← Menengah — gabungan modul nyata (DB + API)
      /----------\
     /    UNIT    \   ← Banyak, cepat, murah — fungsi terisolasi
    /--------------\
```

**Tool yang direkomendasikan:**
| Layer | Tool |
|---|---|
| Unit | [Jest](https://jestjs.io/) |
| Integration | Jest + [Supertest](https://github.com/ladjs/supertest) + MongoDB Memory Server |
| E2E | [Bruno](https://www.usebruno.com/) / Postman / cURL |

---

## Persiapan Lingkungan Pengujian

### Instalasi Dependensi Test

```bash
npm install --save-dev jest supertest @jest/globals
npm install --save-dev @mongodb-jest/mongodb-memory-server
# atau
npm install --save-dev mongodb-memory-server
```

### Struktur Folder Test

```
backend-js/
├── __tests__/
│   ├── unit/
│   │   ├── models/          # Pengujian schema & hooks Mongoose
│   │   ├── services/        # Pengujian logika bisnis
│   │   └── middleware/      # Pengujian middleware auth
│   ├── integration/
│   │   ├── auth.test.js     # Alur login/register
│   │   ├── produk.test.js   # CRUD produk
│   │   ├── penjualan.test.js
│   │   └── pembayaran.test.js
│   └── e2e/
│       └── scenarios/       # Skenario bisnis lengkap
├── jest.config.js
└── jest.setup.js
```

### `jest.config.js`

```js
module.exports = {
  testEnvironment: "node",
  setupFilesAfterFramework: ["./jest.setup.js"],
  testTimeout: 30000,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["services/**/*.js", "models/**/*.js", "middleware/**/*.js"],
};
```

### `jest.setup.js`

```js
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

---

## 🔵 Layer 1 — Unit Testing

> **Tujuan**: Menguji satu unit fungsi/modul secara terisolasi, tanpa koneksi database nyata.  
> **Jumlah**: Mayoritas test suite (≥ 60% dari total test).  
> **Kecepatan**: < 5ms per test.

---

### 1.1 Unit Test: Model Penjualan (Pre-Validate Hook)

**File**: `__tests__/unit/models/penjualanModel.test.js`

**Yang diuji**: Hook `pre('validate')` yang menghitung `totalTagihan`, `sisaTagihan`, dan `statusBayar` secara otomatis.

#### ✅ Skenario A: Transaksi lunas penuh (statusBayar → PAID)

```js
test("harus menghitung totalTagihan dan set statusBayar PAID", async () => {
  const penjualan = new Penjualan({
    tenantID: new mongoose.Types.ObjectId(),
    noReferensi: "INV-001",
    penggunaID: new mongoose.Types.ObjectId(),
    pelangganID: new mongoose.Types.ObjectId(),
    jenisTransaksi: "POS",
    jenisPenjualan: "dine-in",
    tanggalTransaksi: new Date(),
    itemPenjualan: [{
      produkID: new mongoose.Types.ObjectId(),
      namaProduk: "Es Teh Manis",
      jumlah: 2,
      hargaJual: 8000,
      subTotal: 16000,
      jumlahDiskon: 0,
      total: 16000,
      jumlahPajak: 0,
      totalharga: 16000,
    }],
    jumlahDiskonTransaksi: 0,
    jumlahPajakTransaksi: 0,
    totalDibayar: 16000,
  });

  await penjualan.validate();

  expect(penjualan.totalHargaProduk).toBe(16000);
  expect(penjualan.totalTagihan).toBe(16000);
  expect(penjualan.sisaTagihan).toBe(0);
  expect(penjualan.statusBayar).toBe("PAID");
});
```

**Output yang diharapkan**:
```
✓ harus menghitung totalTagihan dan set statusBayar PAID (3ms)
```

---

#### ✅ Skenario B: Pembayaran sebagian (statusBayar → PARTIAL)

```js
test("harus set statusBayar PARTIAL jika totalDibayar sebagian", async () => {
  const penjualan = new Penjualan({
    // ... field wajib lainnya ...
    itemPenjualan: [{
      produkID: new mongoose.Types.ObjectId(),
      namaProduk: "Kopi Susu",
      jumlah: 1,
      hargaJual: 25000,
      subTotal: 25000,
      jumlahDiskon: 0,
      total: 25000,
      jumlahPajak: 0,
      totalharga: 25000,
    }],
    jumlahDiskonTransaksi: 0,
    jumlahPajakTransaksi: 0,
    totalDibayar: 10000, // hanya bayar sebagian
  });

  await penjualan.validate();

  expect(penjualan.totalTagihan).toBe(25000);
  expect(penjualan.sisaTagihan).toBe(15000);
  expect(penjualan.statusBayar).toBe("PARTIAL");
});
```

---

#### ✅ Skenario C: Diskon global memotong totalTagihan

```js
test("diskon global harus mengurangi totalTagihan", async () => {
  const penjualan = new Penjualan({
    // ... field wajib ...
    itemPenjualan: [{
      produkID: new mongoose.Types.ObjectId(),
      namaProduk: "Nasi Goreng",
      jumlah: 1,
      hargaJual: 30000,
      subTotal: 30000,
      jumlahDiskon: 0,
      total: 30000,
      jumlahPajak: 0,
      totalharga: 30000,
    }],
    jumlahDiskonTransaksi: 5000, // diskon global Rp5.000
    jumlahPajakTransaksi: 0,
    totalDibayar: 0,
  });

  await penjualan.validate();

  expect(penjualan.totalHargaProduk).toBe(30000);
  expect(penjualan.totalTagihan).toBe(25000); // 30000 - 5000
  expect(penjualan.statusBayar).toBe("UNPAID");
});
```

---

### 1.2 Unit Test: Model Diskon (Validasi Schema)

**File**: `__tests__/unit/models/diskonModel.test.js`

#### ✅ Skenario A: Diskon persen > 100 harus gagal

```js
test("diskon bertipe persen > 100 harus throw ValidationError", async () => {
  const diskon = new Diskon({
    tenantID: new mongoose.Types.ObjectId(),
    namaDiskon: "Diskon Gila",
    cakupan: "Global",
    tipe: "persen",
    nilai: 150, // invalid
  });

  await expect(diskon.validate()).rejects.toThrow("Diskon bertipe persen tidak boleh melebihi 100");
});
```

#### ✅ Skenario B: Diskon nominal valid harus lolos

```js
test("diskon nominal dengan nilai valid harus lolos validasi", async () => {
  const diskon = new Diskon({
    tenantID: new mongoose.Types.ObjectId(),
    namaDiskon: "Promo Ramadan",
    cakupan: "Item",
    tipe: "nominal",
    nilai: 5000,
    bisaDigabung: true,
    status: "Aktif",
  });

  await expect(diskon.validate()).resolves.toBeUndefined();
});
```

---

### 1.3 Unit Test: Model Pengguna (PIN Hashing)

**File**: `__tests__/unit/models/penggunaModel.test.js`

#### ✅ Skenario A: PIN harus ter-hash sebelum disimpan

```js
test("PIN harus di-hash bcrypt sebelum disimpan ke DB", async () => {
  const pengguna = new Pengguna({
    nama: "Budi Kasir",
    pin: "123456",
    roleID: new mongoose.Types.ObjectId(),
    tenantID: new mongoose.Types.ObjectId(),
  });

  await pengguna.save();

  expect(pengguna.pin).not.toBe("123456");
  expect(pengguna.pin).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
});
```

#### ✅ Skenario B: comparePin harus return true untuk PIN yang benar

```js
test("comparePin harus return true untuk PIN yang cocok", async () => {
  const pengguna = new Pengguna({
    nama: "Siti Kasir",
    pin: "654321",
    roleID: new mongoose.Types.ObjectId(),
    tenantID: new mongoose.Types.ObjectId(),
  });
  await pengguna.save();

  const isMatch = await pengguna.comparePin("654321");
  expect(isMatch).toBe(true);

  const isWrong = await pengguna.comparePin("000000");
  expect(isWrong).toBe(false);
});
```

---

### 1.4 Unit Test: Model SesiBooking (Hitung Durasi)

**File**: `__tests__/unit/models/sesiBookingModel.test.js`

#### ✅ Skenario: Durasi menit dihitung otomatis dari waktuMulai & waktuSelesai

```js
test("durasiMenit harus dihitung otomatis dari selisih waktu", async () => {
  const sesi = new SesiBooking({
    tenantID: new mongoose.Types.ObjectId(),
    dataPengguna: new mongoose.Types.ObjectId(),
    dataPelanggan: new mongoose.Types.ObjectId(),
    dataAset: new mongoose.Types.ObjectId(),
    dataPenjualan: new mongoose.Types.ObjectId(),
    dataTarif: new mongoose.Types.ObjectId(),
    waktuMulai: new Date("2026-03-24T10:00:00Z"),
    waktuSelesai: new Date("2026-03-24T11:30:00Z"),
  });

  await sesi.save();

  expect(sesi.durasiMenit).toBe(90); // 1.5 jam = 90 menit
});
```

---

### 1.5 Unit Test: Middleware `authAkun`

**File**: `__tests__/unit/middleware/authAkun.test.js`

```js
const authAkun = require("../../../middleware/authAkun");
const jwt = require("jsonwebtoken");

test("harus return 401 jika tidak ada Authorization header", async () => {
  const req = { headers: {} };
  const res = {};
  const next = jest.fn();

  await authAkun(req, res, next);

  expect(next).toHaveBeenCalledWith(
    expect.objectContaining({ status: 401 })
  );
});

test("harus return 403 jika token tidak valid", async () => {
  const req = { headers: { authorization: "Bearer token_palsu" } };
  const res = {};
  const next = jest.fn();

  await authAkun(req, res, next);

  expect(next).toHaveBeenCalledWith(
    expect.objectContaining({ status: 403 })
  );
});
```

---

## 🟡 Layer 2 — Integration Testing

> **Tujuan**: Menguji interaksi antar modul (controller + service + model) dengan database in-memory.  
> **Cakupan**: Semua endpoint API utama, request-response cycle lengkap.  
> **Tool**: Jest + Supertest + MongoDB Memory Server.

Setup `supertest`:
```js
const request = require("supertest");
const app = require("../../app");
```

---

### 2.1 Integration Test: Registrasi & Login Akun Owner

**File**: `__tests__/integration/auth.test.js`

#### ✅ Skenario A: Registrasi akun baru berhasil

**`POST /api/akun/auth/register`**

**Request Body:**
```json
{
  "email": "owner@kafemurah.com",
  "password": "Password123!",
  "username": "owner_kafe"
}
```

**Test:**
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
  expect(res.body.data).not.toHaveProperty("password"); // password tidak boleh diekspos
});
```

**Output yang diharapkan:**
```json
{
  "message": "Registrasi berhasil",
  "data": {
    "_id": "667abc...",
    "email": "owner@kafemurah.com",
    "username": "owner_kafe",
    "role": "client",
    "createdAt": "2026-03-24T07:41:00.000Z"
  }
}
```

---

#### ❌ Skenario B: Registrasi dengan email duplikat harus gagal

**Request Body:**
```json
{
  "email": "owner@kafemurah.com",
  "password": "PasswordLain456!",
  "username": "user_duplikat"
}
```

**Output yang diharapkan (HTTP 400):**
```json
{
  "message": "Data 'email' sudah digunakan. Harap gunakan yang lain."
}
```

---

#### ✅ Skenario C: Login berhasil mendapat accessToken

**`POST /api/akun/auth/login`**

**Request Body:**
```json
{
  "email": "owner@kafemurah.com",
  "password": "Password123!",
  "deviceID": "device-laptop-001"
}
```

**Test:**
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

**Output yang diharapkan:**
```json
{
  "message": "Login berhasil",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "_id": "667abc...",
    "email": "owner@kafemurah.com",
    "role": "client"
  }
}
```

---

#### ❌ Skenario D: Login tanpa deviceID harus ditolak

**Request Body:**
```json
{
  "email": "owner@kafemurah.com",
  "password": "Password123!"
}
```

**Output yang diharapkan (HTTP 400):**
```json
{
  "message": "Email, Password, dan Device ID wajib diisi."
}
```

---

### 2.2 Integration Test: CRUD Produk

**File**: `__tests__/integration/produk.test.js`

> **Prerequisite**: Harus punya token `authPengguna` dari login PIN kasir.

#### ✅ Skenario A: Buat produk baru

**`POST /api/produk`**  
**Headers**: `Authorization: Bearer <pengguna_token>`

**Request Body:**
```json
{
  "namaProduk": "Es Kopi Susu",
  "hargaDasar": 12000,
  "hargaJual": 22000,
  "kategoriID": "667bcd123abc...",
  "stok": 50,
  "keterangan": "Kopi susu dengan gula aren",
  "resep": [
    { "bahanBakuID": "667bcd456...", "jumlah": 30, "satuan": "ml" },
    { "bahanBakuID": "667bcd789...", "jumlah": 200, "satuan": "ml" }
  ]
}
```

**Output yang diharapkan (HTTP 201):**
```json
{
  "data": {
    "_id": "667def...",
    "namaProduk": "Es Kopi Susu",
    "hargaDasar": 12000,
    "hargaJual": 22000,
    "stok": 50,
    "kategoriID": "667bcd123abc...",
    "tenantID": "667aaa...",
    "resep": [
      { "bahanBakuID": "667bcd456...", "jumlah": 30, "satuan": "ml" },
      { "bahanBakuID": "667bcd789...", "jumlah": 200, "satuan": "ml" }
    ],
    "pajak": [],
    "createdAt": "2026-03-24T07:41:00.000Z"
  }
}
```

---

#### ❌ Skenario B: Nama produk duplikat dalam satu tenant harus gagal

**Request Body:**
```json
{
  "namaProduk": "Es Kopi Susu",
  "hargaDasar": 10000,
  "hargaJual": 20000,
  "kategoriID": "667bcd123abc..."
}
```

**Output yang diharapkan (HTTP 400):**
```json
{
  "message": "Data 'namaProduk' sudah digunakan. Harap gunakan yang lain."
}
```

---

#### ✅ Skenario C: Get semua produk hanya menampilkan milik tenant sendiri

```js
test("GET /api/produk hanya mengembalikan produk milik tenant sendiri", async () => {
  const res = await request(app)
    .get("/api/produk")
    .set("Authorization", `Bearer ${penggunaToken}`);

  expect(res.statusCode).toBe(200);
  res.body.data.forEach((produk) => {
    expect(produk.tenantID.toString()).toBe(tenantID.toString());
  });
});
```

---

### 2.3 Integration Test: Diskon

**File**: `__tests__/integration/diskon.test.js`

#### ✅ Skenario A: Buat diskon persen per item

**`POST /api/diskon`**  
**Headers**: `Authorization: Bearer <pengguna_token>` (butuh permission `kelola-diskon`)

**Request Body:**
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

**Output yang diharapkan (HTTP 201):**
```json
{
  "data": {
    "_id": "667eee...",
    "tenantID": "667aaa...",
    "namaDiskon": "Diskon Member 10%",
    "cakupan": "Item",
    "tipe": "persen",
    "nilai": 10,
    "bisaDigabung": false,
    "status": "Aktif"
  }
}
```

---

#### ❌ Skenario B: Diskon persen dengan nilai > 100 harus ditolak

**Request Body:**
```json
{
  "namaDiskon": "Diskon Lebay",
  "cakupan": "Global",
  "tipe": "persen",
  "nilai": 110
}
```

**Output yang diharapkan (HTTP 400):**
```json
{
  "message": "Data yang dikirim tidak valid.",
  "errors": ["Diskon bertipe persen tidak boleh melebihi 100"]
}
```

---

#### ❌ Skenario C: Akses tanpa permission `kelola-diskon` harus ditolak

**Output yang diharapkan (HTTP 403):**
```json
{
  "message": "Anda tidak memiliki akses kelola diskon"
}
```

---

### 2.4 Integration Test: Membuat Transaksi Penjualan

**File**: `__tests__/integration/penjualan.test.js`

#### ✅ Skenario A: Transaksi POS dine-in berhasil dibuat

**`POST /api/penjualan`**  
**Headers**: `Authorization: Bearer <pengguna_token>`

**Request Body:**
```json
{
  "noReferensi": "POS-20260324-001",
  "pelangganID": "667ccc...",
  "jenisTransaksi": "POS",
  "jenisPenjualan": "dine-in",
  "tanggalTransaksi": "2026-03-24T07:30:00.000Z",
  "itemPenjualan": [
    {
      "produkID": "667def...",
      "namaProduk": "Es Kopi Susu",
      "jumlah": 2,
      "hargaJual": 22000,
      "subTotal": 44000,
      "jumlahDiskon": 0,
      "total": 44000,
      "jumlahPajak": 0,
      "totalharga": 44000
    },
    {
      "produkID": "667ddd...",
      "namaProduk": "Nasi Goreng Spesial",
      "jumlah": 1,
      "hargaJual": 35000,
      "subTotal": 35000,
      "jumlahDiskon": 0,
      "total": 35000,
      "jumlahPajak": 0,
      "totalharga": 35000
    }
  ],
  "diskonGlobalIDs": [],
  "jumlahDiskonTransaksi": 0,
  "pajakTransaksiIDs": [],
  "jumlahPajakTransaksi": 0,
  "totalDibayar": 0,
  "keterangan": "Meja 3"
}
```

**Output yang diharapkan (HTTP 201):**
```json
{
  "data": {
    "_id": "667fff...",
    "tenantID": "667aaa...",
    "noReferensi": "POS-20260324-001",
    "jenisTransaksi": "POS",
    "jenisPenjualan": "dine-in",
    "statusPenjualan": "DRAFT",
    "statusBayar": "UNPAID",
    "totalHargaProduk": 79000,
    "totalTagihan": 79000,
    "totalDibayar": 0,
    "sisaTagihan": 79000,
    "itemPenjualan": [ "..." ]
  }
}
```

---

#### ✅ Skenario B: Transaksi dengan diskon global nominal

**Request Body (sebagian):**
```json
{
  "noReferensi": "POS-20260324-002",
  "...": "...",
  "itemPenjualan": [{
    "produkID": "667def...",
    "namaProduk": "Es Kopi Susu",
    "jumlah": 3,
    "hargaJual": 22000,
    "subTotal": 66000,
    "jumlahDiskon": 0,
    "total": 66000,
    "jumlahPajak": 0,
    "totalharga": 66000
  }],
  "jumlahDiskonTransaksi": 10000,
  "jumlahPajakTransaksi": 0,
  "totalDibayar": 56000
}
```

**Output yang diharapkan:**
```json
{
  "data": {
    "totalHargaProduk": 66000,
    "jumlahDiskonTransaksi": 10000,
    "totalTagihan": 56000,
    "totalDibayar": 56000,
    "sisaTagihan": 0,
    "statusBayar": "PAID"
  }
}
```

---

#### ❌ Skenario C: noReferensi duplikat dalam satu tenant harus gagal

```json
{
  "message": "Data 'noReferensi' sudah digunakan. Harap gunakan yang lain."
}
```

---

### 2.5 Integration Test: Pembayaran Transaksi

**File**: `__tests__/integration/pembayaran.test.js`

#### ✅ Skenario A: Rekam pembayaran lunas

**`POST /api/pembayaran`**  
**Headers**: `Authorization: Bearer <pengguna_token>` (butuh `kelola-pembayaran`)

**Request Body:**
```json
{
  "penjualanID": "667fff...",
  "akunKasID": "667kkk...",
  "metodePembayaranID": "667mmm...",
  "noReferensi": "POS-20260324-001",
  "jumlahBayar": 79000,
  "tanggalBayar": "2026-03-24T07:45:00.000Z",
  "status": "PAID",
  "catatan": "Bayar tunai"
}
```

**Output yang diharapkan (HTTP 201):**
```json
{
  "data": {
    "_id": "667ppp...",
    "penjualanID": "667fff...",
    "jumlahBayar": 79000,
    "status": "PAID",
    "tanggalBayar": "2026-03-24T07:45:00.000Z"
  }
}
```

---

#### ❌ Skenario B: Status PAID tanpa tanggalBayar harus ditolak

**Request Body:**
```json
{
  "penjualanID": "667fff...",
  "akunKasID": "667kkk...",
  "metodePembayaranID": "667mmm...",
  "noReferensi": "POS-20260324-001",
  "jumlahBayar": 50000,
  "status": "PAID"
}
```

**Output yang diharapkan (HTTP 400):**
```json
{
  "message": "Data yang dikirim tidak valid.",
  "errors": ["Tanggal bayar wajib diisi jika status PAID"]
}
```

---

## 🔴 Layer 3 — End-to-End Testing (E2E)

> **Tujuan**: Menguji alur bisnis lengkap dari awal hingga akhir pada server yang berjalan.  
> **Cakupan**: Skenario realistis seluruh sistem terintegrasi.  
> **Tool**: Bruno / Postman Collection / cURL.

Variabel environment E2E:
```
BASE_URL    = http://localhost:4000/api
AKUN_TOKEN  = (diisi setelah login)
PIN_TOKEN   = (diisi setelah login PIN)
TENANT_ID   = (diisi setelah setup tenant)
```

---

### 🎬 Skenario E2E-01: Setup Toko Baru (Onboarding)

**Alur lengkap**: Registrasi → Login → Buat Tenant → Setup Role → Buat Kasir

---

**Step 1 — Registrasi Akun Owner**

```
POST /api/akun/auth/register
```
```json
{
  "email": "owner@kafe-contoh.com",
  "password": "KafeOwner2026!",
  "username": "owner_kafe_contoh"
}
```
✅ Expected: `201 Created` + akun terbuat

---

**Step 2 — Login Owner**

```
POST /api/akun/auth/login
```
```json
{
  "email": "owner@kafe-contoh.com",
  "password": "KafeOwner2026!",
  "deviceID": "desktop-kasir-01"
}
```
✅ Expected: `200 OK` + simpan `accessToken` ke env `AKUN_TOKEN`

---

**Step 3 — Buat Data Tenant (Toko)**

```
POST /api/tenant
Authorization: Bearer {{AKUN_TOKEN}}
```
```json
{
  "namaToko": "Kafe Contoh Makmur",
  "alamat": "Jl. Sudirman No. 45",
  "kota": "Jakarta",
  "kodePos": "10220",
  "nomorTelepon": "021-55501234",
  "emailBisnis": "cs@kafe-contoh.com",
  "persenPajak": 11,
  "tipePajak": "Belum Termasuk (Exclusive)"
}
```
✅ Expected: `201 Created` + simpan `tenantID`

---

**Step 4 — Buat Role Kasir**

```
POST /api/role
Authorization: Bearer {{AKUN_TOKEN}}
```
```json
{
  "namaRole": "Kasir",
  "deskripsi": "Karyawan kasir yang mengelola transaksi"
}
```
✅ Expected: `201 Created` + simpan `roleID`

---

**Step 5 — Buat Pengguna (Kasir)**

```
POST /api/pengguna/register-owner
Authorization: Bearer {{AKUN_TOKEN}}
```
```json
{
  "nama": "Ahmad Kasir",
  "pin": "123456",
  "roleID": "{{ROLE_ID}}",
  "nomorHp": "081234567890"
}
```
✅ Expected: `201 Created` + pengguna kasir terbuat

---

**Step 6 — Login PIN Kasir**

```
POST /api/pengguna/pin-login
Authorization: Bearer {{AKUN_TOKEN}}
```
```json
{
  "penggunaID": "{{PENGGUNA_ID}}",
  "pin": "123456"
}
```
✅ Expected: `200 OK` + simpan `PIN_TOKEN` ke env

---

### 🎬 Skenario E2E-02: Transaksi POS Lengkap (Dine-In Cash)

**Alur**: Buat Pelanggan → Buat Produk → Buat Penjualan → Bayar → Cek Status PAID

---

**Step 1 — Tambah Pelanggan**

```
POST /api/pelanggan
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "namaPelanggan": "Pelanggan Umum",
  "tipePelanggan": "umum",
  "nomorHp": "08112233445"
}
```
✅ Expected: `201` + simpan `pelangganID`

---

**Step 2 — Tambah Kategori Produk**

```
POST /api/kategori
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "namaKategori": "Minuman"
}
```
✅ Expected: `201` + simpan `kategoriID`

---

**Step 3 — Tambah Produk**

```
POST /api/produk
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "namaProduk": "Es Teh Manis",
  "hargaDasar": 3000,
  "hargaJual": 8000,
  "kategoriID": "{{KATEGORI_ID}}",
  "stok": 100
}
```
✅ Expected: `201` + simpan `produkID`

---

**Step 4 — Buat Transaksi Penjualan**

```
POST /api/penjualan
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "noReferensi": "POS-E2E-001",
  "pelangganID": "{{PELANGGAN_ID}}",
  "jenisTransaksi": "POS",
  "jenisPenjualan": "dine-in",
  "tanggalTransaksi": "2026-03-24T08:00:00.000Z",
  "itemPenjualan": [
    {
      "produkID": "{{PRODUK_ID}}",
      "namaProduk": "Es Teh Manis",
      "jumlah": 3,
      "hargaJual": 8000,
      "subTotal": 24000,
      "jumlahDiskon": 0,
      "total": 24000,
      "jumlahPajak": 0,
      "totalharga": 24000
    }
  ],
  "jumlahDiskonTransaksi": 0,
  "jumlahPajakTransaksi": 0,
  "totalDibayar": 0
}
```
✅ Expected: `201` + `statusBayar: "UNPAID"` + `totalTagihan: 24000` + simpan `penjualanID`

---

**Step 5 — Proses Pembayaran**

```
POST /api/pembayaran
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "penjualanID": "{{PENJUALAN_ID}}",
  "akunKasID": "{{AKUN_KAS_ID}}",
  "metodePembayaranID": "{{METODE_BAYAR_ID}}",
  "noReferensi": "POS-E2E-001",
  "jumlahBayar": 24000,
  "tanggalBayar": "2026-03-24T08:05:00.000Z",
  "status": "PAID",
  "catatan": "Tunai pas"
}
```
✅ Expected: `201` + `status: "PAID"`

---

**Step 6 — Verifikasi Status Penjualan**

```
GET /api/penjualan/{{PENJUALAN_ID}}
Authorization: Bearer {{PIN_TOKEN}}
```
✅ Expected:
```json
{
  "data": {
    "statusBayar": "PAID",
    "sisaTagihan": 0,
    "totalDibayar": 24000
  }
}
```

---

### 🎬 Skenario E2E-03: Booking Sesi Aset (Meja Biliar)

**Alur**: Buat Aset → Buat Tarif → Buka Sesi → Tutup Sesi → Bayar

---

**Step 1 — Buat Tipe Aset**

```
POST /api/tipeaset
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{ "namaTipeAset": "Meja Biliar" }
```

---

**Step 2 — Buat Aset**

```
POST /api/aset
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "namaAset": "Meja Biliar A",
  "tipeAsetID": "{{TIPE_ASET_ID}}",
  "status": "tersedia"
}
```

---

**Step 3 — Buat Tarif**

```
POST /api/tarif
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "namaTarif": "Tarif Normal Biliar",
  "hargaPerJam": 30000,
  "tipeAsetID": "{{TIPE_ASET_ID}}"
}
```

---

**Step 4 — Buka Sesi Booking**

```
POST /api/sesibooking
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "dataPelanggan": "{{PELANGGAN_ID}}",
  "dataAset": "{{ASET_ID}}",
  "dataTarif": "{{TARIF_ID}}",
  "dataPenjualan": "{{PENJUALAN_BOOKING_ID}}",
  "waktuMulai": "2026-03-24T14:00:00.000Z",
  "status": "Aktif"
}
```
✅ Expected: `201` + `status: "Aktif"` + simpan `sesiID`

---

**Step 5 — Tutup Sesi (set waktuSelesai)**

```
PUT /api/sesibooking/{{SESI_ID}}
Authorization: Bearer {{PIN_TOKEN}}
```
```json
{
  "waktuSelesai": "2026-03-24T16:00:00.000Z",
  "status": "Selesai"
}
```
✅ Expected: `200` + `durasiMenit: 120` + `status: "Selesai"`

---

### 🎬 Skenario E2E-04: Keamanan Isolasi Data Antar Tenant

**Tujuan**: Memastikan data Tenant A tidak bisa diakses oleh user Tenant B.

---

**Step 1** — Login sebagai kasir Tenant A, buat produk `"Produk Rahasia"`, simpan `produkID`.

**Step 2** — Login sebagai kasir Tenant B (token berbeda).

**Step 3** — Coba akses produk Tenant A:

```
GET /api/produk/{{PRODUK_ID_TENANT_A}}
Authorization: Bearer {{TOKEN_TENANT_B}}
```

✅ Expected: `404 Not Found`
```json
{
  "message": "Resource tidak ditemukan (ID Invalid)."
}
```

**Step 4** — Coba buat penjualan menggunakan `produkID` dari Tenant A:

✅ Expected: `400 Bad Request` atau `404 Not Found` (produk tidak ditemukan di tenant B)

---

### 🎬 Skenario E2E-05: Multi-Device Auth & Forced Logout

**Tujuan**: Memastikan token lama tidak valid setelah logout paksa.

**Step 1** — Login dari Device 1 (`deviceID: "laptop-01"`), simpan `TOKEN_1`.

**Step 2** — Logout dari Device 1:
```
POST /api/akun/auth/logout
Authorization: Bearer {{TOKEN_1}}
```
✅ Expected: `200 OK` + cookie refreshToken dihapus

**Step 3** — Coba pakai `TOKEN_1` yang sudah logout:
```
GET /api/akun/auth/akun
Authorization: Bearer {{TOKEN_1}}
```
✅ Expected: `401 Unauthorized`
```json
{
  "message": "Sesi telah berakhir di perangkat ini. Silakan login ulang."
}
```

---

## 📊 Ringkasan Test Coverage yang Ditargetkan

| Layer | Jumlah Test | Coverage Target | Kecepatan |
|---|---|---|---|
| **Unit** | ≥ 50 test cases | 80% fungsi service & model | < 10ms/test |
| **Integration** | ≥ 30 test cases | Semua endpoint utama | < 500ms/test |
| **E2E** | ≥ 10 skenario | Alur bisnis kritis | < 5 detik/skenario |

### Jalankan Test

```bash
# Semua test
npx jest

# Hanya unit test
npx jest __tests__/unit

# Hanya integration test
npx jest __tests__/integration

# Dengan coverage report
npx jest --coverage

# Watch mode (development)
npx jest --watch
```

### Interpretasi Hasil

```
PASS  __tests__/unit/models/penjualanModel.test.js
PASS  __tests__/integration/penjualan.test.js
FAIL  __tests__/integration/pembayaran.test.js
  ● POST /api/pembayaran › status PAID tanpa tanggalBayar harus ditolak
    Expected: 400
    Received: 500
```

> **Tip**: Jika test integration mengembalikan 500, periksa error handler dan pastikan validasi Mongoose sudah dilempar ke `next(err)` dengan benar di controller.

---

## 📌 Catatan Penting

1. **Isolasi Test**: Setiap test case harus bersifat independen. Gunakan `beforeEach`/`afterEach` untuk membersihkan database.
2. **Data Seed**: Buat helper function `seedTenant()`, `seedPengguna()`, `seedProduk()`, dsb. untuk menghindari duplikasi setup di setiap test.
3. **Token Management**: Simpan token ke variabel scope `describe` bukan global, agar test tidak saling bergantung.
4. **Environment E2E**: Gunakan database atau server terpisah untuk E2E agar tidak mengotori data development.
5. **Webhook & Redis**: Mock Redis (`ioredis-mock`) untuk unit & integration test agar tidak perlu Redis nyata.
