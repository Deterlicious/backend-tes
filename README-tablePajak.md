# 📑 Smart Tax Engine Module (Multi-Tenant SaaS)

Modul ini adalah mesin kalkulasi pajak otomatis yang dirancang untuk kebutuhan sistem **Point of Sale (POS)** atau **ERP** berbasis SaaS. Sistem ini mendukung perhitungan pajak yang kompleks, isolasi data antar tenant, dan performa tinggi dengan caching.

---

## 🚀 Fitur Utama

- **Multi-Tenant Isolation**: Keamanan data terjamin dengan pemisahan akses menggunakan `tenantID`.
- **Triple-Model Calculation**: Mendukung 3 standar perhitungan:
  - **Inclusive**: Pajak di dalam harga (Retail).
  - **Exclusive**: Pajak ditambahkan ke harga dasar (Jasa/General).
  - **Compound**: Pajak berlapis/berjenjang (Restoran - Service Charge & PB1).
- **Priority-Based Sorting**: Menjamin urutan perhitungan pajak yang akurat sesuai aturan akuntansi.
- **Data Denormalization**: Menyimpan _snapshot_ nama pajak pada tabel relasi untuk efisiensi pembacaan data.
- **Robust Error Handling**: Filtrasi otomatis untuk data pajak yang tidak valid atau telah dihapus.

---

## 📂 Struktur Database (Schema)

### 1. Master Pajak (`pajaks`)

Menyimpan konfigurasi aturan pajak yang dapat dikelola oleh user.

| Kolom              | Tipe    | Deskripsi                                             |
| :----------------- | :------ | :---------------------------------------------------- |
| `namaPajak`        | String  | Nama identitas pajak (Contoh: PPN, PB1).              |
| `tarifPajak`       | Number  | Persentase nilai (Contoh: 10 untuk 10%).              |
| `modelPerhitungan` | Number  | 1: Inclusive, 2: Exclusive, 3: Compound.              |
| `prioritas`        | Number  | Urutan eksekusi (Angka terkecil diproses lebih dulu). |
| `tipePajak`        | Enum    | Klasifikasi (Per Produk / Per Transaksi).             |
| `statusPajak`      | Boolean | Status aktif/non-aktif.                               |

### 2. Produk Pajak (`produkpajaks`)

Tabel relasi antara Produk dan Aturan Pajak.

| Kolom       | Tipe     | Deskripsi                               |
| :---------- | :------- | :-------------------------------------- |
| `produkID`  | ObjectId | Referensi ke tabel Produk.              |
| `pajakID`   | ObjectId | Referensi ke tabel Master Pajak.        |
| `namaPajak` | String   | Snapshot nama pajak saat relasi dibuat. |

---

## 🧮 Logika Kalkulasi

### Model 1: Inclusive (Tax Included)

Pajak sudah terhitung di dalam harga yang tertera.

- **Rumus**: `Pajak = Harga - (Harga / (1 + (Tarif/100)))`

### Model 2: Exclusive (Tax Added)

Pajak ditambahkan langsung dari harga dasar produk.

- **Rumus**: `Pajak = Harga Dasar * (Tarif/100)`

### Model 3: Compound (Tax on Tax)

Pajak dihitung dari nilai kumulatif harga dasar ditambah pajak prioritas sebelumnya.

- **Rumus**: `Pajak = (Harga Dasar + Pajak Sebelumnya) * (Tarif/100)`

---

## 🧪 Panduan Testing (Postman)

### 1. Simulasi Kalkulasi

**Endpoint**: `POST /api/pajak/simulasi`

**Request Body**:

```json
{
  "produkID": "ID_PRODUK_CONTOH",
  "harga": 100000
}
```
{
  "success": true,
  "data": {
    "hargaAwal": 100000,
    "totalPajak": 15500,
    "grandTotal": 115500,
    "rincian": [
      {
        "namaPajak": "Service Charge",
        "tarif": 5,
        "model": "Exclusive",
        "prioritas": 1,
        "jumlah": 5000
      },
      {
        "namaPajak": "PB1",
        "tarif": 10,
        "model": "Compound",
        "prioritas": 2,
        "jumlah": 10500
      }
    ]
  }
}