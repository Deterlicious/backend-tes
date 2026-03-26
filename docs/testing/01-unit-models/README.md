# 🔵 Unit Test — Model Mongoose

> **Tujuan**: Menguji schema validation, hooks, dan computed fields pada model Mongoose secara terisolasi menggunakan MongoDB Memory Server.  
> **File lokasi test**: `__tests__/unit/models/`  
> **Setup**: `jest.setup.unit.js` dengan MongoMemoryServer.

---

## Daftar Model yang Diuji

| File | Model | Yang Diuji |
|---|---|---|
| [penjualan.md](./penjualan.md) | `Penjualan` | `pre('validate')` — totalTagihan, sisaTagihan, statusBayar |
| [diskon.md](./diskon.md) | `Diskon` | Custom validator persen ≤ 100, enum, constraint negatif |
| [pengguna.md](./pengguna.md) | `Pengguna` | bcrypt PIN hashing, `comparePin()` |
| [sesiBooking.md](./sesiBooking.md) | `SesiBooking` | Kalkulasi `durasiMenit` otomatis |
| [pembayaran.md](./pembayaran.md) | `Pembayaran` | `pre('validate')` — PAID wajib tanggalBayar |
| [pajak.md](./pajak.md) | `Pajak` | Required fields, enum modelPerhitungan & prioritas |
| [pelanggan.md](./pelanggan.md) | `Pelanggan` | Unique index per tenant, partial index |
| [tarif.md](./tarif.md) | `Tarif` | Enum basisPerhitungan, min harga & durasiMinimum |
| [tenant.md](./tenant.md) | `Tenant` | Max persenPajak 100, enum tipePajak & status |
