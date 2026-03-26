# Unit Test — Model Tenant

**File test**: `__tests__/unit/models/tenantModel.test.js`  
**Yang diuji**: Required field `namaToko`, default values (`status`, `isSetupComplete`, `persenPajak`, `tipePajak`), constraint `persenPajak max 100`, dan enum validasi `tipePajak` & `status`.

---

## Setup

```js
const mongoose = require("mongoose");
const Tenant = require("../../../models/tenantModel");

const baseTenant = (overrides = {}) => ({
  namaToko: "Kafe Test",
  ...overrides,
});
```

---

## Skenario

### ✅ A: Tenant valid harus lolos validasi

```js
test("A: tenant valid harus lolos validasi", async () => {
  const t = new Tenant(baseTenant());
  await expect(t.validate()).resolves.toBeUndefined();
});
```

### ✅ B: `status` default adalah `aktif`

```js
test("B: status default adalah aktif", async () => {
  const t = new Tenant(baseTenant());
  await t.validate();
  expect(t.status).toBe("aktif");
});
```

### ✅ C: `isSetupComplete` default adalah `false`

```js
test("C: isSetupComplete default false", async () => {
  const t = new Tenant(baseTenant());
  await t.validate();
  expect(t.isSetupComplete).toBe(false);
});
```

### ✅ D: `persenPajak` default adalah `0`

```js
test("D: persenPajak default 0", async () => {
  const t = new Tenant(baseTenant());
  await t.validate();
  expect(t.persenPajak).toBe(0);
});
```

### ❌ E: `persenPajak` tidak boleh lebih dari 100

```js
test("E: persenPajak > 100 harus ditolak", async () => {
  const t = new Tenant(baseTenant({ persenPajak: 101 }));
  await expect(t.validate()).rejects.toThrow();
});
```

### ✅ F: `persenPajak` tepat 100 harus lolos

```js
test("F: persenPajak tepat 100 harus lolos", async () => {
  const t = new Tenant(baseTenant({ persenPajak: 100 }));
  await expect(t.validate()).resolves.toBeUndefined();
});
```

### ❌ G: `tipePajak` di luar enum harus ditolak

```js
test("G: tipePajak selain enum harus ditolak", async () => {
  const t = new Tenant(baseTenant({ tipePajak: "Gratis" }));
  await expect(t.validate()).rejects.toThrow();
});
```

### ✅ H: `tipePajak` default adalah `Sudah Termasuk (Inclusive)`

```js
test("H: tipePajak default Sudah Termasuk (Inclusive)", async () => {
  const t = new Tenant(baseTenant());
  await t.validate();
  expect(t.tipePajak).toBe("Sudah Termasuk (Inclusive)");
});
```

### ❌ I: `status` di luar enum harus ditolak

```js
test("I: status selain aktif/non-aktif harus ditolak", async () => {
  const t = new Tenant(baseTenant({ status: "suspend" }));
  await expect(t.validate()).rejects.toThrow();
});
```

### ❌ J: `namaToko` wajib diisi

```js
test("J: namaToko wajib diisi", async () => {
  const t = new Tenant(baseTenant({ namaToko: undefined }));
  await expect(t.validate()).rejects.toThrow();
});
```
