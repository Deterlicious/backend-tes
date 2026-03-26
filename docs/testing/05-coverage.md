# 📊 Coverage Target & Catatan Penting

## Target Coverage Per Layer

| Layer | Jumlah Test | Coverage Target | Kecepatan |
|---|---|---|---|
| **Unit — Model** | ≥ 50 test cases | 85% fungsi & hook model | < 10ms/test |
| **Unit — Middleware** | ≥ 10 test cases | 90% branch middleware | < 5ms/test |
| **Integration** | ≥ 35 test cases | Semua endpoint utama | < 500ms/test |
| **E2E** | ≥ 10 skenario | Alur bisnis kritis | < 5 detik/skenario |

### Ringkasan Model yang Sudah Memiliki Unit Test

| Model | File Test | Hook / Yang Diuji |
|---|---|---|
| `Penjualan` | `penjualanModel.test.js` | `pre('validate')` — totalTagihan, sisaTagihan, statusBayar |
| `Diskon` | `diskonModel.test.js` | Validasi persen ≤ 100, enum cakupan & tipe |
| `Pengguna` | `penggunaModel.test.js` | bcrypt PIN hashing, `comparePin()` |
| `SesiBooking` | `sesiBookingModel.test.js` | Kalkulasi `durasiMenit` |
| `Pembayaran` | `pembayaranModel.test.js` | `pre('validate')` — PAID wajib tanggalBayar |
| `Pajak` | `pajakModel.test.js` | Validasi required fields, enum modelPerhitungan & prioritas |
| `Pelanggan` | `pelangganModel.test.js` | Unique index per tenant (nama, nomorHp, email) |
| `Tarif` | `tarifModel.test.js` | Enum basisPerhitungan, min harga & durasiMinimum |
| `Tenant` | `tenantModel.test.js` | Max persenPajak 100, enum tipePajak & status |

---

## Catatan Penting

### 1. Isolasi Test
Setiap test case harus bersifat independen. Gunakan `beforeEach`/`afterEach` untuk membersihkan database. Jangan gunakan `afterAll` untuk bersih-bersih data jika ada `afterEach`.

### 2. Helper Factory Function
Buat helper function untuk menghindari duplikasi setup:

```js
// __tests__/helpers/seed.js
const seedTenant = async () => Tenant.create({ namaToko: "Toko Test" });
const seedPengguna = async (tenantID, roleID) =>
  Pengguna.create({ nama: "Kasir Test", pin: "123456", tenantID, roleID });
const seedProduk = async (tenantID, kategoriID) =>
  Produk.create({ namaProduk: "Produk Test", hargaJual: 10000, tenantID, kategoriID });

module.exports = { seedTenant, seedPengguna, seedProduk };
```

### 3. Token Management
Simpan token ke variabel scope `describe`, bukan global:

```js
describe("Integration: Auth Flow", () => {
  let akunToken;         // scope describe
  let penggunaToken;

  beforeAll(async () => {
    // Setup dan dapatkan token
    const res = await request(app).post("...").send({ ... });
    akunToken = res.body.accessToken;
  });
});
```

### 4. Mock Redis (ioredis)
Untuk unit & integration test, mock Redis agar tidak memerlukan server Redis nyata:

```js
// jest.setup.js
jest.mock("ioredis", () => require("ioredis-mock"));
```

### 5. Environment E2E
Gunakan database atau server terpisah untuk E2E agar tidak mengotori data development:

```bash
NODE_ENV=test DATABASE_URL=mongodb://localhost:27017/pos_test npx jest __tests__/e2e
```

### 6. Partial Unique Index
Saat menguji unique index yang menggunakan `partialFilterExpression` (seperti `nomorHp` dan `email` pada `pelangganModel`), pastikan test case mencakup:
- Dua record **dengan** field yang sama → harus gagal
- Dua record **tanpa** field tersebut → harus lolos (karena partial index tidak berlaku)

### 7. Mongoose Model Reuse Error
Saat test berjalan, Mongoose dapat throw `OverwriteModelError` jika model didaftarkan lebih dari sekali. Gunakan pola berikut dalam setiap model:

```js
module.exports = mongoose.models.NamaModel || mongoose.model("NamaModel", schema);
```

---

## Perintah Lengkap

```bash
# Jalankan semua test
npx jest

# Hanya unit test model
npx jest __tests__/unit/models

# Hanya unit test middleware
npx jest __tests__/unit/middleware

# Hanya integration test
npx jest __tests__/integration

# Coverage report
npx jest --coverage

# Test file spesifik
npx jest __tests__/unit/models/pembayaranModel.test.js

# Watch mode (development)
npx jest --watch

# Verbose output
npx jest --verbose
```
