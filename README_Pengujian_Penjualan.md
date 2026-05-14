# 🧪 Laporan Pengujian Unit: Modul Penjualan

> Dokumen ini merangkum seluruh hasil pengujian unit pada lapisan arsitektur (Model, Validator, Service, Controller, dan Route) untuk modul Penjualan beserta dependensinya.

# 🗄️ Pengujian Bagian 1: Model
### 📄 1. Program `metodePembayaranModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dengan default value
- ✅ **2.** Harus mengaktifkan timestamps dan menonaktifkan versionKey pada opsi Schema
- ✅ **3.** Bisa secara eksplisit mengatur isActive menjadi false saat pembuatan
- ✅ **4.** Harus melakukan trim pada field namaPembayaran
- ✅ **5.** Harus melakukan trim pada field xenditChannelCode

#### 🔍 B. Pengujian Validasi Field Wajib & Enum

- ✅ **1.** Gagal validasi jika field wajib (tenantID, akunKasID, namaPembayaran, kategori) kosong
- ✅ **2.** Gagal validasi jika namaPembayaran hanya berisi string kosong
- ✅ **3.** Gagal validasi jika kategori di luar pilihan enum
- ✅ **4.** Gagal validasi jika kategori menggunakan huruf besar (case sensitive)

#### 🔍 C. Pengujian Pre-validate Hook (Logika isAutomated)

- ✅ **1.** Sukses jika isAutomated true, kategori non-tunai, dan memiliki channel code
- ✅ **2.** Gagal validasi jika isAutomated true tetapi menggunakan kategori tunai
- ✅ **3.** Gagal validasi jika isAutomated true tetapi xenditChannelCode kosong
- ✅ **4.** Gagal validasi jika xenditChannelCode hanya berisi spasi saat isAutomated true
- ✅ **5.** Harus otomatis mengubah xenditChannelCode menjadi null jika isAutomated false
- ✅ **6.** Harus tetap null jika isAutomated false dan xenditChannelCode tidak dikirim

---

### 📄 2. Program `pembayaranModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dengan default value
- ✅ **2.** Harus mengaktifkan timestamps dan menonaktifkan versionKey pada opsi Schema
- ✅ **3.** Harus melakukan trim pada field string (noReferensi, gatewayPaymentID, qrString, catatan)

#### 🔍 B. Pengujian Validasi Field Wajib & Enum

- ✅ **1.** Gagal validasi jika field wajib kosong
- ✅ **2.** Gagal validasi jika jumlahBayar bernilai negatif
- ✅ **3.** Gagal validasi jika status di luar pilihan enum
- ✅ **4.** Gagal validasi jika status menggunakan huruf kecil (case sensitive)

#### 🔍 C. Pengujian Pre-validate Hook (Logika Status & Tanggal Bayar)

- ✅ **1.** Sukses validasi jika status 'PAID' dan tanggalBayar telah diisi
- ✅ **2.** Gagal validasi jika status 'PAID' tetapi tanggalBayar dibiarkan kosong (null)
- ✅ **3.** Sukses validasi jika status selain 'PAID' dan tanggalBayar kosong (null)

---

### 📄 3. Program `penjualanModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dan memastikan nilai default (Status Penjualan, Status Bayar, Jatuh Tempo, Item default)
- ✅ **2.** Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar
- ✅ **3.** Harus melakukan trim (hapus spasi berlebih) pada string yang relevan

#### 🔍 B. Pengujian Validasi Field Wajib (Required) & Minimum Value

- ✅ **1.** Gagal validasi jika seluruh field wajib di root dokumen dikosongkan
- ✅ **2.** Gagal validasi jika field wajib di dalam sub-dokumen itemPenjualan dikosongkan
- ✅ **3.** Gagal validasi jika jumlah, hargaJual, atau jumlahDiskon bernilai di bawah batas minimum (negatif/nol)

#### 🔍 C. Pengujian Validasi Enum Pilihan

- ✅ **1.** Gagal validasi jika jenisTransaksi, jenisPenjualan, statusPenjualan, atau statusBayar di luar opsi valid

#### 🔍 D. Pengujian Logika Pre-Validate Hook (Kalkulasi Tagihan & Status Bayar)

- ✅ **1.** Hook menetapkan angka negatif pada item (subTotal, total, totalharga) menjadi 0 (Clamping)
- ✅ **2.** Kalkulasi status: 'PAID' karena diskon menutupi seluruh harga (Total Tagihan <= 0 di-clamp ke 0)
- ✅ **3.** Kalkulasi status: 'PARTIAL' jika ada pembayaran yang masuk namun belum lunas
- ✅ **4.** Kalkulasi status: 'UNPAID' jika belum ada pembayaran sama sekali
- ✅ **5.** Tidak gagal meskipun array itemPenjualan kosong atau undefined

---

### 📄 4. Program `sesiBookingModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dan memastikan default value (Selesai, Durasi, Status, Biaya)
- ✅ **2.** Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar

#### 🔍 B. Pengujian Validasi Field Wajib (Required) & Tipe Data

- ✅ **1.** Gagal validasi jika seluruh field wajib (ObjectId & Date) dikosongkan
- ✅ **2.** Gagal validasi jika field referensi diberikan nilai yang bukan ObjectId valid (CastError)

#### 🔍 C. Pengujian Validasi Enum & Batasan Angka (Min)

- ✅ **1.** Gagal validasi jika status diisi nilai di luar Enum ('Aktif', 'Selesai', 'Batal')
- ✅ **2.** Gagal validasi jika durasiMenit atau totalBiaya bernilai negatif (kurang dari 0)

#### 🔍 D. Pengujian Logika Pre-Save Hook (Validasi Waktu & Kalkulasi Durasi)

- ✅ **1.** Hook langsung memanggil next() tanpa modifikasi jika waktuSelesai belum diisi (masih null/Aktif)
- ✅ **2.** Gagal (Melempar Error) jika waktuSelesai lebih awal dari waktuMulai (Mundur)
- ✅ **3.** Sukses menghitung dan membulatkan ke atas (Math.ceil) durasiMenit jika waktuSelesai dan waktuMulai valid
- ✅ **4.** Sukses menghitung durasiMenit secara akurat (Tepat bilangan bulat)

---

### 📄 5. Program `diskonModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dengan default value
- ✅ **2.** Harus mengaktifkan timestamps dan menonaktifkan versionKey pada opsi Schema
- ✅ **3.** Harus melakukan trim pada field namaDiskon

#### 🔍 B. Pengujian Validasi Field Wajib & Enum

- ✅ **1.** Gagal validasi jika field wajib kosong
- ✅ **2.** Gagal validasi jika cakupan di luar pilihan enum
- ✅ **3.** Gagal validasi jika tipe di luar pilihan enum
- ✅ **4.** Gagal validasi jika status di luar pilihan enum

#### 🔍 C. Pengujian Validasi Custom Logika: Nilai Diskon

- ✅ **1.** Gagal validasi jika nilai diskon bernilai negatif
- ✅ **2.** Sukses validasi jika tipe 'persen' dan nilai tepat 100
- ✅ **3.** Gagal validasi jika tipe 'persen' dan nilai lebih dari 100
- ✅ **4.** Sukses validasi jika tipe 'nominal' dan nilai lebih dari 100

---

### 📄 6. Program `asetModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dan memastikan default value 'status' adalah 'tersedia'
- ✅ **2.** Harus melakukan trim (menghapus spasi berlebih) pada field namaAset
- ✅ **3.** Memastikan opsi Schema (timestamps & versionKey) dikonfigurasi dengan benar

#### 🔍 B. Pengujian Validasi Field Wajib (Required)

- ✅ **1.** Gagal validasi jika field wajib (tenantID, namaAset, tipeAsetID) kosong
- ✅ **2.** Gagal validasi jika tipe data ObjectId tidak sesuai

#### 🔍 C. Pengujian Validasi Enum (Status)

- ✅ **1.** Gagal validasi jika status diisi dengan nilai di luar pilihan Enum
- ✅ **2.** Sukses validasi jika status diisi dengan nilai yang sah ('digunakan' / 'perbaikan')

---

### 📄 7. Program `tipeAsetModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dengan default value
- ✅ **2.** Harus melakukan trim pada field namaTipeAset
- ✅ **3.** Memastikan opsi Schema (timestamps, versionKey, virtuals) dikonfigurasi dengan benar

#### 🔍 B. Pengujian Validasi Field Wajib

- ✅ **1.** Gagal validasi jika tenantID kosong
- ✅ **2.** Gagal validasi jika namaTipeAset kosong

#### 🔍 C. Pengujian Konfigurasi Virtual Field (listTarif)

- ✅ **1.** Memastikan virtual field 'listTarif' dikonfigurasi untuk relasi ke Tarif secara One-to-Many

---

### 📄 8. Program `tarifModel.test.js`

#### 🔍 A. Pengujian Konfigurasi Skema & Default Value

- ✅ **1.** Sukses membuat instance valid dengan default value yang benar
- ✅ **2.** Harus mengaktifkan timestamps pada opsi Schema
- ✅ **3.** Harus melakukan trim pada field string (namaTarif, jamMulai, jamSelesai)

#### 🔍 B. Pengujian Validasi Field Wajib & Batasan Nilai (Min)

- ✅ **1.** Gagal validasi jika field wajib kosong
- ✅ **2.** Gagal validasi jika harga bernilai negatif (di bawah min 0)
- ✅ **3.** Gagal validasi jika durasiMinimum kurang dari 1

#### 🔍 C. Pengujian Validasi Enum

- ✅ **1.** Gagal validasi jika basisPerhitungan di luar pilihan enum
- ✅ **2.** Gagal validasi jika array hariAktif berisi angka di luar 0-6 (Enum Hari)
- ✅ **3.** Sukses memvalidasi array hariAktif jika diisi rentang 0-6

---

# 🛡️ Pengujian Bagian 2: Validator
### 📄 1. Program `metodePembayaranValidator.test.js`

#### 🔍 A. Pengujian Validasi Format Payload Umum

- ✅ **1.** Sukses lolos validasi jika payload valid
- ✅ **2.** Gagal validasi jika payload kosong ({})
- ✅ **3.** Gagal validasi jika payload bernilai null, string, atau array (Edge Case Tipe Data)
- ✅ **4.** Gagal validasi jika mendeteksi indikasi NoSQL Injection object

#### 🔍 B. Pengujian Validasi Mode: Create (isUpdate = false)

- ✅ **1.** Gagal validasi jika format ObjectId untuk tenantID atau akunKasID tidak valid
- ✅ **2.** Gagal validasi jika kategori di luar pilihan yang sah
- ✅ **3.** Gagal validasi jika namaPembayaran hanya berisi spasi whitespace

#### 🔍 C. Pengujian Validasi Mode: Update (isUpdate = true)

- ✅ **1.** Sukses lolos validasi jika field wajib bersifat opsional saat update
- ✅ **2.** Sukses lolos validasi update parsial (misal: hanya mengupdate isActive)

#### 🔍 D. Pengujian Validasi Logika isAutomated (Xendit)

- ✅ **1.** Gagal validasi jika metode automated menggunakan kategori tunai
- ✅ **2.** Gagal validasi jika metode automated tidak menyertakan xenditChannelCode
- ✅ **3.** Sukses lolos validasi logis (fallback ke false) jika isAutomated dikirim sebagai string 'true'

---

### 📄 2. Program `pembayaranValidator.test.js`

#### 🔍 A. Pengujian Validasi Mode: Create (isUpdate = false)

- ✅ **1.** Sukses lolos validasi untuk payload lengkap dan valid
- ✅ **2.** Gagal validasi jika field wajib berbentuk ObjectId kosong atau formatnya invalid
- ✅ **3.** Gagal validasi jika akunKasID dikirim dengan format string biasa (bukan ObjectId)

#### 🔍 B. Pengujian Validasi Mode: Update (isUpdate = true)

- ✅ **1.** Sukses lolos validasi jika melakukan update parsial (contoh: hanya status)
- ✅ **2.** Gagal validasi jika update mencoba mengubah akunKasID dengan format invalid

#### 🔍 C. Pengujian Validasi Logika jumlahBayar

- ✅ **1.** Sukses lolos validasi jika jumlahBayar dikirim sebagai string angka
- ✅ **2.** Gagal validasi jika jumlahBayar bernilai negatif (Mode Create)
- ✅ **3.** Gagal validasi jika jumlahBayar bernilai negatif (Mode Update)
- ✅ **4.** Gagal validasi jika jumlahBayar dikirim dengan karakter non-angka (NaN)

#### 🔍 D. Pengujian Validasi Logika status

- ✅ **1.** Sukses lolos validasi jika status sesuai dengan pilihan Enum
- ✅ **2.** Gagal validasi jika status di luar pilihan Enum

#### 🔍 E. Pengujian Validasi Logika tanggalBayar

- ✅ **1.** Sukses lolos validasi jika tanggalBayar berisi format ISO string yang valid
- ✅ **2.** Gagal validasi jika properti tanggalBayar ada tetapi bernilai null
- ✅ **3.** Gagal validasi jika properti tanggalBayar ada tetapi berupa string kosong
- ✅ **4.** Gagal validasi jika tanggalBayar diisi dengan teks sembarangan (Invalid Date)
- ✅ **5.** Sukses (Dilewati) jika tanggalBayar tidak disertakan sama sekali dalam payload

---

### 📄 3. Program `penjualanValidator.test.js`

#### 🔍 A. Pengujian Aturan Global & Helper Functions

- ✅ **1.** Gagal jika simpanDraft atau finalize bukan boolean
- ✅ **2.** Gagal jika statusPenjualan tidak valid (DRAFT/FINAL/VOID)
- ✅ **3.** Sukses memvalidasi array/single ID pada diskonGlobalIDs dan pajakTransaksiIDs

#### 🔍 B. Pengujian Mode Create (!isUpdate)

- ✅ **1.** Sukses (Valid) untuk payload dasar yang lengkap dan benar
- ✅ **2.** Gagal jika field root wajib kosong atau invalid format
- ✅ **3.** Gagal jika tanggalTransaksi berada di masa depan (> 1 menit dari sekarang)
- ✅ **4.** Gagal jika format tanggalTransaksi atau jatuhTempo tidak valid
- ✅ **5.** Gagal jika itemPenjualan kosong atau bukan array
- ✅ **6.** Gagal jika detail itemPenjualan tidak valid (ID, Jumlah, Harga, Diskon)

#### 🔍 C. Pengujian Mode Update (isUpdate = true)

- ✅ **1.** Sukses (Valid) untuk payload update kosong (tidak ada yang diubah)
- ✅ **2.** Sukses memvalidasi update parsial yang benar
- ✅ **3.** Gagal jika payload update membawa data tidak valid
- ✅ **4.** Gagal jika update mengirimkan array itemPenjualan kosong

---

### 📄 4. Program `sesiBookingValidator.test.js`

#### 🔍 A. Pengujian Mode Create (!isUpdate)

- ✅ **1.** Sukses (Valid) untuk payload dasar yang lengkap dan benar
- ✅ **2.** Sukses (Valid) dengan menyertakan semua optional fields yang valid
- ✅ **3.** Gagal jika field wajib kosong
- ✅ **4.** Gagal jika format ObjectId tidak valid
- ✅ **5.** Gagal jika format Date (waktuMulai & waktuSelesai) tidak valid
- ✅ **6.** Gagal jika field opsional array (diskonItem/diskonGlobal) bukan array atau isinya invalid
- ✅ **7.** Gagal jika tipe simpanDraft bukan boolean, noReferensi kosong, atau status di luar Enum

#### 🔍 B. Pengujian Mode Update (isUpdate = true)

- ✅ **1.** Sukses (Valid) untuk payload update kosong (tidak ada yang diubah)
- ✅ **2.** Gagal jika mencoba mengubah dataPenjualan (Terlarang/Proteksi Invoice)
- ✅ **3.** Gagal jika update mengirimkan ObjectId, Date, Status atau Array yang invalid

#### 🔍 C. Pengujian Validasi Rentang Waktu (WaktuRange)

- ✅ **1.** Gagal jika waktuSelesai sama dengan atau lebih kecil dari waktuMulai (Mundur/Nol)
- ✅ **2.** Sukses (Valid) memasukkan tanggal ke masa lalu

#### 🔍 D. Pengujian Validasi Array 'items' (Multiple Sesi Booking / Cart)

- ✅ **1.** Sukses dengan array items yang valid
- ✅ **2.** Gagal jika items bukan array atau merupakan array kosong
- ✅ **3.** Gagal jika items mengandung data yang invalid (Aset, Tanggal, Rentang, Tarif, Diskon)

---

### 📄 5. Program `diskonValidator.test.js`

#### 🔍 A. Pengujian Validasi Mode: Create (isUpdate = false)

- ✅ **1.** Sukses lolos validasi jika payload lengkap dan valid
- ✅ **2.** Gagal validasi jika field wajib (tenantID, namaDiskon, cakupan, tipe, nilai) kosong
- ✅ **3.** Gagal validasi jika tenantID formatnya bukan ObjectId yang valid
- ✅ **4.** Gagal validasi jika namaDiskon hanya berisi spasi kosong (whitespace)
- ✅ **5.** Gagal validasi jika tipe atau cakupan di luar pilihan Enum

#### 🔍 B. Pengujian Validasi Mode: Update (isUpdate = true)

- ✅ **1.** Sukses lolos validasi untuk update parsial
- ✅ **2.** Gagal validasi jika field opsional yang dikirim tidak valid bentuknya

#### 🔍 C. Pengujian Validasi Logika Kombinasi Tipe & Nilai

- ✅ **1.** Gagal validasi jika nilai diskon bernilai negatif
- ✅ **2.** Gagal validasi jika tipe 'persen' dan nilai lebih dari 100
- ✅ **3.** Sukses lolos validasi jika tipe 'persen' dan nilai tepat 100
- ✅ **4.** Sukses lolos validasi jika tipe 'nominal' dan nilai lebih dari 100
- ✅ **5.** Sukses lolos validasi jika nilai diskon adalah 0

---

### 📄 6. Program `asetValidator.test.js`

#### 🔍 A. Pengujian Validasi Mode: Create (isUpdate = false)

- ✅ **1.** Sukses lolos validasi jika payload lengkap dan valid
- ✅ **2.** Gagal validasi jika field wajib (tenantID, namaAset, tipeAsetID) kosong
- ✅ **3.** Gagal validasi jika tenantID formatnya bukan ObjectId yang valid
- ✅ **4.** Gagal validasi jika tipeAsetID formatnya bukan ObjectId yang valid

#### 🔍 B. Pengujian Validasi Mode: Update (isUpdate = true)

- ✅ **1.** Sukses lolos validasi untuk update parsial (hanya ubah namaAset)
- ✅ **2.** Sukses lolos validasi jika payload update kosong (tidak ada modifikasi)
- ✅ **3.** Gagal validasi jika payload update menyertakan tipeAsetID yang tidak valid

#### 🔍 C. Pengujian Validasi Status (Enum)

- ✅ **1.** Sukses validasi jika status diisi dengan nilai yang valid ('tersedia', 'digunakan', 'perbaikan')
- ✅ **2.** Gagal validasi jika status diisi dengan nilai di luar Enum

---

### 📄 7. Program `tipeAsetValidator.test.js`

#### 🔍 A. Pengujian Validasi Mode: Create (isUpdate = false)

- ✅ **1.** Sukses lolos validasi jika payload lengkap dan valid
- ✅ **2.** Gagal validasi jika tenantID dan namaTipeAset tidak dikirim
- ✅ **3.** Gagal validasi jika tenantID formatnya bukan ObjectId yang valid
- ✅ **4.** Gagal validasi jika namaTipeAset hanya berisi spasi (whitespace)

#### 🔍 B. Pengujian Validasi Mode: Update (isUpdate = true)

- ✅ **1.** Sukses lolos validasi untuk update parsial
- ✅ **2.** Sukses lolos validasi jika payload kosong saat update (tidak ada field yang diubah)
- ✅ **3.** Gagal validasi jika payload update mengirimkan namaTipeAset yang kosong

#### 🔍 C. Pengujian Validasi Batasan Karakter (namaTipeAset)

- ✅ **1.** Gagal validasi jika namaTipeAset kurang dari 2 karakter
- ✅ **2.** Gagal validasi jika namaTipeAset kurang dari 2 karakter SETELAH di-trim
- ✅ **3.** Sukses validasi jika namaTipeAset tepat 2 karakter

---

### 📄 8. Program `tarifValidator.test.js`

#### 🔍 A. Pengujian Validasi Mode: Create (isUpdate = false)

- ✅ **1.** Sukses lolos validasi jika payload lengkap dan valid
- ✅ **2.** Gagal validasi jika field wajib kosong
- ✅ **3.** Gagal validasi jika tenantID formatnya bukan ObjectId yang valid

#### 🔍 B. Pengujian Validasi Mode: Update (isUpdate = true)

- ✅ **1.** Sukses lolos validasi untuk update parsial (misal hanya ubah harga)
- ✅ **2.** Gagal validasi jika field update yang dikirim tidak sesuai aturan

#### 🔍 C. Pengujian Validasi Logika Field Angka (Harga & Durasi)

- ✅ **1.** Gagal validasi jika harga bukan angka yang valid atau negatif
- ✅ **2.** Sukses jika harga bernilai 0 (gratis)
- ✅ **3.** Gagal validasi jika durasiMinimum kurang dari 1 atau bukan angka

#### 🔍 D. Pengujian Validasi Enum & Array (hariAktif & basisPerhitungan)

- ✅ **1.** Gagal jika hariAktif dikirim bukan sebagai array
- ✅ **2.** Gagal jika hariAktif mengandung angka di luar 0-6
- ✅ **3.** Sukses jika hariAktif adalah array kosong (berlaku semua hari/default logic)

#### 🔍 E. Pengujian Validasi Format dan Logika Waktu (jamMulai & jamSelesai)

- ✅ **1.** Gagal validasi jika format waktu tidak sesuai regex HH:mm
- ✅ **2.** Gagal validasi jika jamMulai lebih besar dari jamSelesai (Logika Perbandingan)
- ✅ **3.** Gagal validasi jika jamMulai dan jamSelesai diatur pada waktu yang persis sama

#### 🔍 F. Pengujian Validasi tipeAsetID

- ✅ **1.** Gagal jika tipeAsetID berisi ID yang tidak valid
- ✅ **2.** Sukses memvalidasi tipeAsetID yang dikirim sebagai string tunggal (bukan array)



---

# ⚙️ Pengujian Bagian 3: Service
### 📄 1. Program `metodePembayaranService.test.js`

#### 🔍 A. Method: _formatOutput

- ✅ **1.** Sukses memformat dokumen tunggal
- ✅ **2.** Sukses memformat array dokumen
- ✅ **3.** Mengembalikan null jika dokumen kosong
- ✅ **4.** Mengembalikan array kosong jika input array kosong
- ✅ **5.** dataAkunKas bernilai null jika akunKasID hanya berupa string atau undefined
- ✅ **6.** xenditChannelCode fallback ke null jika undefined

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Gagal (Throw 400) jika tenantID tidak dikirim
- ✅ **2.** Sukses (Cache Hit) mengembalikan data dari Redis
- ✅ **3.** Sukses (Cache Miss) mengambil data dari DB lalu simpan ke cache
- ✅ **4.** Mengembalikan null atau array kosong jika data tidak ditemukan

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Gagal jika validasi payload atau akunKas tidak ditemukan
- ✅ **2.** Sukses membuat/memperbarui data dan membersihkan cache (list & detail)
- ✅ **3.** Memaksa xenditChannelCode menjadi null jika isAutomated false
- ✅ **4.** Mencegah perubahan tenantID melalui payload update
- ✅ **5.** Sukses menghapus data dan mengembalikan response yang sesuai

---

### 📄 2. Program `pembayaranService.test.js`

#### 🔍 A. Internal Method: Helper Functions

- ✅ **1.** Method _toNumber sukses mengkonversi berbagai format ke angka
- ✅ **2.** Method _idOnly sukses mengekstrak ID atau mengembalikan nilai asli
- ✅ **3.** Method _formatOutput sukses memformat dokumen tunggal maupun array

#### 🔍 B. Internal Method: _updateSaldoAkunKas & _syncPenjualan

- ✅ **1.** Gagal (Throw 404/400) jika akun kas tidak ditemukan atau saldo menjadi negatif
- ✅ **2.** Sukses memperbarui saldo akun kas dan menghapus cache terkait
- ✅ **3.** Sukses sinkronisasi totalDibayar pada Penjualan dan menangani rollback status ke DRAFT jika ada VOID

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Gagal jika status Penjualan VOID atau sudah lunas (PAID)
- ✅ **2.** Gagal jika jumlahBayar melebihi sisa tagihan
- ✅ **3.** Sukses create/update dan otomatis menjalankan update saldo serta sinkronisasi
- ✅ **4.** Sukses delete dan merevert saldo kas jika data berstatus PAID

---

### 📄 3. Program `penjualanService.test.js`

#### 🔍 A. Fungsi Internal & Formatters

- ✅ **1.** _normalizeIds: Mengembalikan array string yang valid
- ✅ **2.** _generateNoReferensi: Format WIB (UTC+7) POS dan INVOICE sudah sesuai
- ✅ **3.** _formatOutput: Sukses format data lengkap termasuk object pajak

#### 🔍 B. Fungsi Filter (_applyFilters)

- ✅ **1.** Filter sukses berdasarkan pencarian string, status, dan object referensi
- ✅ **2.** Filter rentang tanggal (Start & End Date) berfungsi akurat

#### 🔍 C. Kalkulasi Matematika & _recalc

- ✅ **1.** _applyDiskonBerurutan: Menghitung diskon dengan clamping minimal 0
- ✅ **2.** _applyPajakTransaksi: Menghitung model Inclusive, Exclusive, dan Compound
- ✅ **3.** _recalc: Kalkulasi keseluruhan sukses termasuk clamping diskon manual agar tidak melebihi subtotal

#### 🔍 D. Method: create, update, delete & void

- ✅ **1.** Sukses create FINAL dan otomatis memotong stok produk
- ✅ **2.** Proteksi update: Mencegah perubahan status jika sudah VOID atau transisi ilegal
- ✅ **3.** Sukses melakukan VOID dan membatalkan status Sesi Booking terkait
- ✅ **4.** Proteksi delete: Hanya mengizinkan penghapusan pada status DRAFT

---

### 📄 4. Program `sesiBookingService.test.js`

#### 🔍 A. Fungsi Internal & Perhitungan Tarif

- ✅ **1.** _generateNoReferensi: Menghasilkan format timezone WIB yang benar
- ✅ **2.** _checkConflict: Mendeteksi bentrok jadwal pada aset yang sama
- ✅ **3.** _findBestTarif: Memilih tarif berdasarkan prioritas tertinggi
- ✅ **4.** _calculateCost: Menghitung biaya per jam dengan aturan durasi minimum

#### 🔍 B. Diskon Berlapis & Cache

- ✅ **1.** _applyDiskonBerurutan: Menghitung diskon berlapis tanpa nilai minus
- ✅ **2.** Method getAll: Auto-selesai sesi expired dan manajemen cache Redis

#### 🔍 C. Method: create, update & delete

- ✅ **1.** create & createBatch: Sukses membuat sesi (tunggal/massal) dan integrasi ke invoice
- ✅ **2.** Proteksi IDOR: Memastikan aset milik tenant yang bersangkutan
- ✅ **3.** Update: Sinkronisasi harga ke Penjualan jika jadwal diubah
- ✅ **4.** Delete: Merevert item di Penjualan dan menghapus invoice jika item habis

---

### 📄 5. Program `diskonService.test.js`

#### 🔍 A. Manajemen Cache & Pengambilan Data

- ✅ **1.** clearCache: Membersihkan list dan detail menggunakan pola SCAN
- ✅ **2.** getAll & getById: Mendukung Cache Hit/Miss dan isolasi keamanan antar tenant

#### 🔍 B. Validasi Kombinasi & Potongan

- ✅ **1.** validateKombinasiDiskon: Mendeteksi diskon yang tidak boleh digabung (non-stackable)
- ✅ **2.** hitungDanValidasiPotongan: Kalkulasi akurat untuk tipe persen/nominal
- ✅ **3.** Proteksi potongan: Mencegah diskon melebihi harga awal (clamping)

#### 🔍 C. create & update

- ✅ **1.** Sukses create/update dengan penanganan error duplicate nama (11000)
- ✅ **2.** Proteksi update: Menghapus tenantID dari payload untuk mencegah manipulasi

---

### 📄 6. Program `asetService.test.js`

#### 🔍 A. Logika Status Dinamis & Cache

- ✅ **1.** _formatOutput: Mengubah status menjadi 'digunakan' secara real-time jika ada booking aktif
- ✅ **2.** Priority Status: Tetap menampilkan 'perbaikan' meskipun ada jadwal booking
- ✅ **3.** Cache Management: Menggunakan EX 60 detik untuk data status yang dinamis

#### 🔍 B. create, update & delete

- ✅ **1.** create: Memaksa status awal menjadi 'tersedia' untuk integritas data
- ✅ **2.** update: Mendukung update parsial dan proteksi manipulasi tenantID
- ✅ **3.** delete: Sukses menghapus data dan membersihkan cache list/detail

---

### 📄 7. Program `tipeAsetService.test.js`

#### 🔍 A. Sinkronisasi Relasi & Cache

- ✅ **1.** clearCache & _clearTarifCache: Membersihkan cache tipe aset dan tarif sekaligus
- ✅ **2.** _formatOutput: Transformasi virtual field listTarif menjadi dataTarif sukses

#### 🔍 B. create, update & delete

- ✅ **1.** create: Menangani error duplicate dan melakukan auto-populate data baru
- ✅ **2.** update: Sinkronisasi pembersihan cache pada dua domain (Tipe Aset & Tarif)
- ✅ **3.** delete: Sukses mencabut relasi ($pull) pada tabel Tarif saat tipe aset dihapus

---

### 📄 8. Program `tarifService.test.js`

#### 🔍 A. Keamanan & Verifikasi Aset

- ✅ **1.** verifyAssetOwnership: Mendeteksi dan mencegah penggunaan tipe aset milik tenant lain
- ✅ **2.** clearCache: Pembersihan cache list dengan SCAN dan detail ID sukses

#### 🔍 B. Format & Filter

- ✅ **1.** _formatOutput: Transformasi tipeAsetID menjadi objek dataAset yang bersih
- ✅ **2.** getAll: Konversi string filter (isActive) menjadi boolean secara otomatis

#### 🔍 C. create, update & delete

- ✅ **1.** create: Memastikan tipeAsetID menjadi array dan memverifikasi kepemilikan aset
- ✅ **2.** update: Menggunakan operator $addToSet untuk efisiensi update array tipe aset
- ✅ **3.** delete: Penghapusan permanen dan invalidasi cache detail sukses

---

# 🎮 Pengujian Bagian 4: Controller
### 📄 1. Program `metodePembayaranController.test.js`

#### 🔍 A. Method: _getRequesterTenantID

- ✅ **1.** Sukses mengekstrak tenantID dari request

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses memanggil getAll dan mengembalikan status 200 dengan data
- ✅ **2.** Sukses memanggil getById dan mengembalikan status 200 dengan data spesifik

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses create data baru dan mengembalikan status 201
- ✅ **2.** Sukses update data dan mengembalikan status 200
- ✅ **3.** Sukses delete data dan mengembalikan status 200

---

### 📄 2. Program `pembayaranController.test.js`

#### 🔍 A. Method: _getRequesterTenantID

- ✅ **1.** Sukses mengekstrak tenantID dari request

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses memanggil getAll dan mengembalikan status 200
- ✅ **2.** Sukses memanggil getById dan mengembalikan status 200

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses create data baru dan mengembalikan status 201
- ✅ **2.** Sukses update data dan mengembalikan status 200
- ✅ **3.** Sukses delete data dan mengembalikan status 200

---

### 📄 3. Program `penjualanController.test.js`

#### 🔍 A. Internal Methods: _getRequesterTenantID & _getRequesterPenggunaID

- ✅ **1.** Sukses mengekstrak tenantID dan penggunaID dari request

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses mengambil semua data penjualan
- ✅ **2.** Sukses mengambil detail data penjualan berdasarkan ID

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses membuat data penjualan baru
- ✅ **2.** Sukses melakukan pembaruan data penjualan
- ✅ **3.** Sukses menghapus atau me-void data penjualan

---

### 📄 4. Program `sesiBookingController.test.js`

#### 🔍 A. Method: _getRequesterTenantID & _getRequesterUserID

- ✅ **1.** Sukses mengekstrak informasi konteks pengguna dan tenant

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses mengambil daftar sesi booking
- ✅ **2.** Sukses mengambil detail sesi booking

#### 🔍 C. Method: create (Single & Batch Dinamis), update, & delete

- ✅ **1.** Sukses membuat sesi booking tunggal dan batch
- ✅ **2.** Sukses memperbarui informasi sesi booking
- ✅ **3.** Sukses membatalkan atau menghapus sesi booking

---

### 📄 5. Program `diskonController.test.js`

#### 🔍 A. Method: _getRequesterTenantID

- ✅ **1.** Sukses mengekstrak tenantID

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses mengambil list diskon
- ✅ **2.** Sukses mengambil detail diskon

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses membuat diskon baru
- ✅ **2.** Sukses memperbarui diskon
- ✅ **3.** Sukses menghapus diskon

---

### 📄 6. Program `asetController.test.js`

#### 🔍 A. Method: _getRequesterTenantID

- ✅ **1.** Sukses mengekstrak tenantID

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses mengambil data aset
- ✅ **2.** Sukses mengambil data aset berdasarkan ID

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses menambahkan aset baru
- ✅ **2.** Sukses mengubah data aset
- ✅ **3.** Sukses menghapus data aset

---

### 📄 7. Program `tipeAsetController.test.js`

#### 🔍 A. Method: _getRequesterTenantID

- ✅ **1.** Sukses mengekstrak tenantID

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses mengambil daftar tipe aset
- ✅ **2.** Sukses mengambil tipe aset secara spesifik

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses membuat tipe aset baru
- ✅ **2.** Sukses memodifikasi tipe aset
- ✅ **3.** Sukses menghapus tipe aset

---

### 📄 8. Program `tarifController.test.js`

#### 🔍 A. Method: _getRequesterTenantID

- ✅ **1.** Sukses mengekstrak tenantID

#### 🔍 B. Method: getAll & getById

- ✅ **1.** Sukses mengambil seluruh data tarif
- ✅ **2.** Sukses mengambil detail tarif tertentu

#### 🔍 C. Method: create, update & delete

- ✅ **1.** Sukses mendaftarkan tarif baru
- ✅ **2.** Sukses memperbarui komponen tarif
- ✅ **3.** Sukses menghapus tarif

---

# 🛣️ Pengujian Bagian 5: Route
### 📄 1. Program `metodePembayaranRoute.test.js`

#### 🔍 A. Middleware Otentikasi

- ✅ **1.** Sukses memblokir akses jika tidak memiliki token

#### 🔍 B. Endpoint Success Path (Happy Path) & Error Handling

- ✅ **1.** Sukses melewati rute GET `/` dan GET `/:id` dengan status 200
- ✅ **2.** Sukses melewati rute POST `/`, PUT `/:id`, dan DELETE `/:id`
- ✅ **3.** Sukses menangani method yang tidak diizinkan
- ✅ **4.** Penolakan Izin (Permission) jika tidak ada hak akses

---

### 📄 2. Program `pembayaranRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Permission (Role Based Access Control)

- ✅ **1.** Sukses memverifikasi otentikasi
- ✅ **2.** Sukses menolak akses tanpa permission yang sesuai

#### 🔍 B. Endpoint Success Path (Happy Path)

- ✅ **1.** Rute CRUD terhubung dengan baik ke Controller (status 200/201)

---

### 📄 3. Program `penjualanRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Izin (checkPermission / RBAC)

- ✅ **1.** Berhasil melindungi rute dari user tidak terotentikasi
- ✅ **2.** Berhasil menerapkan Role Based Access Control untuk data penjualan

#### 🔍 B. Endpoint Success Path & Controller Binding

- ✅ **1.** Endpoint pemanggilan berhasil terhubung dengan controller terkait
- ✅ **2.** Validasi parameter string RBAC sukses menangani error

---

### 📄 4. Program `sesiBookingRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Permission (RBAC) - Ketat

- ✅ **1.** Sukses memverifikasi sesi booking dengan hak akses secara ketat
- ✅ **2.** Pengguna tanpa izin gagal mengakses rute

#### 🔍 B. Endpoint Success Path (Happy Path) & Binding

- ✅ **1.** Semua rute sesi booking berhasil memanggil fungsi di controller
- ✅ **2.** Konfigurasi string izin dan error wrapper teruji dan berjalan normal

---

### 📄 5. Program `diskonRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Permission (RBAC)

- ✅ **1.** Sukses mendeteksi request tanpa akses (401/403)

#### 🔍 B. Endpoint Success Path (Happy Path) & Konfigurasi Izin

- ✅ **1.** Endpoint Diskon sukses memberikan response 2xx sesuai ekspektasi
- ✅ **2.** Binding middleware pada semua rute diskon valid

---

### 📄 6. Program `asetRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Permission (RBAC)

- ✅ **1.** Sukses melindungi rute master data aset

#### 🔍 B. Endpoint Success Path (Happy Path) & Konfigurasi Izin

- ✅ **1.** Rute CRUD master data aset berhasil dieksekusi secara terintegrasi
- ✅ **2.** String Izin RBAC terkait aset dikonfigurasi dengan benar

---

### 📄 7. Program `tipeAsetRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Permission (RBAC)

- ✅ **1.** Sukses mengamankan rute tipe aset dengan otentikasi wajib

#### 🔍 B. Endpoint Success Path (Happy Path) & Konfigurasi Izin

- ✅ **1.** Happy path untuk tipe aset mengembalikan status respons yang benar
- ✅ **2.** Rute terikat secara aman dengan izin yang tepat

---

### 📄 8. Program `tarifRoute.test.js`

#### 🔍 A. Middleware Otentikasi & Verifikasi Proteksi Permission (RBAC)

- ✅ **1.** Pengaturan keamanan untuk tarif tervalidasi

#### 🔍 B. Endpoint Success Path (Happy Path) & Konfigurasi Izin

- ✅ **1.** Sukses melakukan pemanggilan API tarif dan mendapat response yang tepat
- ✅ **2.** Pengujian integrasi proteksi izin untuk rute tarif sukses

---