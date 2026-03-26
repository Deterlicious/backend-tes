# 🧪 Panduan Pengujian Backend — Overview & Setup

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
│   │   ├── diskon.test.js
│   │   └── pembayaran.test.js
│   └── e2e/
│       └── scenarios/       # Skenario bisnis lengkap
├── docs/
│   └── testing/
│       ├── 00-overview.md           ← file ini
│       ├── 01-unit-models.md        # Unit test: semua model
│       ├── 02-unit-middleware.md    # Unit test: middleware
│       ├── 03-integration.md        # Integration test: API endpoints
│       ├── 04-e2e.md                # Skenario E2E
│       └── 05-coverage.md           # Target coverage & tips
├── jest.config.js
├── jest.setup.js
├── jest.setup.unit.js
└── jest.setup.integration.js
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

### `jest.setup.js` (Unit — MongoDB Memory Server)

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

## Menjalankan Test

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

# Test file tertentu
npx jest __tests__/unit/models/penjualanModel.test.js
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

## Dokumen Lanjutan

| File | Isi |
|---|---|
| [01-unit-models.md](./01-unit-models.md) | Unit test semua model Mongoose |
| [02-unit-middleware.md](./02-unit-middleware.md) | Unit test middleware autentikasi |
| [03-integration.md](./03-integration.md) | Integration test semua endpoint API |
| [04-e2e.md](./04-e2e.md) | Skenario E2E full bisnis |
| [05-coverage.md](./05-coverage.md) | Target coverage & catatan penting |
