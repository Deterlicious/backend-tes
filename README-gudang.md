📦 Dokumentasi Alur Kerja Modul Gudang (WMS)
Dokumentasi ini menjelaskan urutan langkah dan logika fitur yang harus diikuti untuk mengoperasikan sistem manajemen gudang secara benar, mulai dari pendaftaran barang hingga perpindahan stok antar lokasi.

1. Persiapan Master Data (Inisialisasi)
   Sebelum melakukan mutasi, sistem harus memiliki data dasar yang valid.

Pendaftaran Lokasi:

Pengguna mendaftarkan entitas lokasi (Contoh: "Gudang Pusat" sebagai sumber barang dan "Outlet Sudirman" sebagai penerima).

Sistem memisahkan stok berdasarkan ID unik lokasi tersebut.

Pendaftaran Bahan Baku:

Pengguna memasukkan katalog barang (Contoh: "Biji Kopi Arabika") dengan satuan yang jelas (kg/pcs).

Kolom stok di sini berfungsi sebagai informasi saldo global atau awal.

Pengisian Stok Awal (Inventory):

Pengguna memasukkan jumlah stok fisik ke lokasi tertentu agar sistem memiliki saldo awal untuk dipindahkan.

2. Alur Permintaan Stok (Stock Request Workflow)
   Ini adalah inti dari mutasi barang yang terdiri dari beberapa tahapan status:

A. Tahap Pembuatan (Draft)
Flow: Lokasi tujuan (Outlet) membuat dokumen permintaan kepada lokasi asal (Gudang).

Fitur Otomatis: Sistem secara otomatis menghasilkan Nomor Request unik (Contoh: REQ/202602/0001) sehingga pengguna tidak perlu mengisi nomor dokumen manual.

Kondisi: Stok di database belum berubah sama sekali.

B. Tahap Pengajuan (Submit)
Flow: Staf outlet mengajukan dokumen tersebut ke pusat.

Kondisi: Dokumen terkunci dan siap untuk ditinjau oleh Admin Gudang.

C. Tahap Persetujuan & Mutasi (Approve/Complete)
Ini adalah tahap paling krusial di mana validasi dan perpindahan terjadi:

Validasi Ketersediaan: Saat tombol Approve ditekan, sistem otomatis mengecek apakah stok di lokasi asal (Gudang) mencukupi untuk jumlah yang diminta.

Penolakan Otomatis: Jika stok kurang, sistem akan menolak permintaan dan memberikan peringatan "Stok Tidak Mencukupi".

Eksekusi Mutasi: Jika stok cukup, sistem akan menjalankan dua aksi sekaligus:

Mengurangi stok di lokasi asal (Gudang).

Menambah stok di lokasi tujuan (Outlet).

Penyelesaian: Status dokumen berubah menjadi COMPLETED dan tidak dapat diubah lagi.

3. Alur Verifikasi & Caching
   Pembaruan Real-time: Setelah mutasi selesai, sistem secara otomatis membersihkan memori sementara (Redis Cache).

Pengecekan Akhir: Saat pengguna melihat daftar stok (Inventory), sistem akan menampilkan angka terbaru yang sudah sinkron antara Gudang dan Outlet tanpa perlu melakukan sinkronisasi manual.

Ringkasan Status Dokumen:
DRAFT: Dokumen baru dibuat, masih bisa diedit.

SUBMITTED: Menunggu persetujuan pusat.

REJECTED: Permintaan ditolak (stok tidak berpindah).

COMPLETED: Stok telah resmi berpindah dan transaksi selesai.
