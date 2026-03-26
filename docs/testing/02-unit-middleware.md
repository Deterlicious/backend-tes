# 🔵 Unit Test — Middleware

> **Tujuan**: Menguji middleware secara terisolasi menggunakan mock object `req`, `res`, `next`.  
> **File lokasi**: `__tests__/unit/middleware/`

---

## 2.1 Unit Test: Middleware `authAkun`

**File**: `__tests__/unit/middleware/authAkun.test.js`

Middleware `authAkun` memverifikasi JWT Bearer token dari header `Authorization` dan melindungi endpoint yang memerlukan autentikasi akun owner.

```js
const authAkun = require("../../../middleware/authAkun");
const jwt = require("jsonwebtoken");

describe("Middleware authAkun", () => {
  test("harus return 401 jika tidak ada Authorization header", async () => {
    const req = { headers: {} };
    const res = {};
    const next = jest.fn();

    await authAkun(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401 })
    );
  });

  test("harus return 403 jika token tidak valid / expired", async () => {
    const req = { headers: { authorization: "Bearer token_palsu_tidak_valid" } };
    const res = {};
    const next = jest.fn();

    await authAkun(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 })
    );
  });

  test("harus memanggil next() tanpa error jika token valid", async () => {
    const payload = { _id: "667abc", role: "client" };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "test-secret");

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();

    await authAkun(req, res, next);

    expect(next).toHaveBeenCalledWith(); // dipanggil tanpa argumen error
    expect(req.akun).toBeDefined();
    expect(req.akun._id).toBe("667abc");
  });

  test("harus return 401 jika format header bukan 'Bearer <token>'", async () => {
    const req = { headers: { authorization: "Basic sometoken" } };
    const res = {};
    const next = jest.fn();

    await authAkun(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401 })
    );
  });
});
```

---

## 2.2 Unit Test: Middleware `authPengguna`

**File**: `__tests__/unit/middleware/authPengguna.test.js`

Middleware `authPengguna` memverifikasi PIN token kasir (token berbeda dari token akun owner).

```js
const authPengguna = require("../../../middleware/authPengguna");
const jwt = require("jsonwebtoken");

describe("Middleware authPengguna", () => {
  test("harus return 401 jika tidak ada Authorization header", async () => {
    const req = { headers: {} };
    const res = {};
    const next = jest.fn();

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401 })
    );
  });

  test("harus return 403 jika token pengguna tidak valid", async () => {
    const req = { headers: { authorization: "Bearer invalid_pengguna_token" } };
    const res = {};
    const next = jest.fn();

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 })
    );
  });

  test("harus set req.pengguna jika token valid", async () => {
    const payload = {
      _id: "667bbb",
      tenantID: "667aaa",
      roleID: "667rrr",
    };
    const token = jwt.sign(payload, process.env.JWT_PENGGUNA_SECRET || "pengguna-secret");

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();

    await authPengguna(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.pengguna).toBeDefined();
    expect(req.pengguna.tenantID).toBe("667aaa");
  });
});
```

---

## 2.3 Unit Test: Middleware `checkPermission`

**File**: `__tests__/unit/middleware/checkPermission.test.js`

Middleware `checkPermission` memvalidasi apakah pengguna memiliki permission tertentu pada role-nya.

```js
const checkPermission = require("../../../middleware/checkPermission");

describe("Middleware checkPermission", () => {
  const makeReq = (permissions = []) => ({
    pengguna: {
      _id: "667bbb",
      tenantID: "667aaa",
      permissions, // sudah di-attach oleh authPengguna
    },
    headers: {},
  });

  test("harus memanggil next() jika pengguna punya permission yang dibutuhkan", () => {
    const req = makeReq(["kelola-produk", "kelola-transaksi"]);
    const res = {};
    const next = jest.fn();

    checkPermission("kelola-produk")(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test("harus return 403 jika pengguna tidak punya permission", () => {
    const req = makeReq(["kelola-produk"]);
    const res = {};
    const next = jest.fn();

    checkPermission("kelola-diskon")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 })
    );
  });

  test("harus return 403 jika req.pengguna tidak terdefinisi", () => {
    const req = { headers: {} }; // tanpa pengguna
    const res = {};
    const next = jest.fn();

    checkPermission("kelola-produk")(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 })
    );
  });
});
```

---

## Catatan

- **Isolasi penuh**: Test middleware tidak memerlukan koneksi database. Semua dependency di-mock.
- **JWT Secret**: Gunakan `process.env.JWT_SECRET` atau fallback `"test-secret"` — pastikan test environment memiliki set variable ini di `jest.setup.js`.
- **Mock `next`**: Selalu gunakan `jest.fn()` sebagai `next` agar bisa di-inspect apakah dipanggil dengan error atau tidak.
