const Membership = require("../models/membershipModel");
const mongoose = require("mongoose");

// Asumsi model PaketMembership diimpor di scope ini (diperlukan untuk CREATE)
const PaketMembership =
  mongoose.models.PaketMembership || require("../models/paketMembershipModel");

// Fungsi bantuan untuk membuat pesan error Mongoose lebih informatif
const handleValidationError = (err) => {
  let errors = {};
  if (err.name === "ValidationError") {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
    return { message: "Validasi data gagal. Cek detail errors.", errors };
  } // Tangani error duplikasi (Unique Index Error pada penjualanID atau compound index lainnya)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue); // Di model Membership, ini paling mungkin terjadi pada 'penjualanID'
    return {
      message: `Gagal menambahkan/memperbarui. Dokumen dengan ${field} '${err.keyValue[field]}' sudah terdaftar.`,
    };
  }
  return { message: "Terjadi kesalahan pada server." };
};

// ===============================================
// ✅ CREATE: Tambah Membership (REVISI VALIDASI & KEAMANAN)
// ===============================================
exports.createMembership = async (req, res) => {
  try {
    const {
      tenantID,
      PelangganID,
      paketMembershipID,
      tanggalMulai,
      tanggalKadaluarsa,
    } = req.body;

    // Pre-check 1: Validasi ID dasar
    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Input tidak valid. tenantID wajib diisi dan harus berupa ObjectId yang benar.",
      });
    }
    if (!PelangganID || !mongoose.Types.ObjectId.isValid(PelangganID)) {
      return res.status(400).json({
        message:
          "Input tidak valid. PelangganID wajib diisi dan harus berupa ObjectId yang benar.",
      });
    }
    if (
      !paketMembershipID ||
      !mongoose.Types.ObjectId.isValid(paketMembershipID)
    ) {
      return res.status(400).json({
        message:
          "Input tidak valid. paketMembershipID wajib diisi dan harus berupa ObjectId yang benar.",
      });
    } // --- Validasi Kustom Tanggal (Logika Bisnis) --- // 1. Cek paket membership

    const paket = await PaketMembership.findById(paketMembershipID);
    if (!paket) {
      return res
        .status(400)
        .json({ message: "Paket Membership tidak ditemukan." });
    } // 2. Hitung tanggal kadaluarsa yang seharusnya
    const tglMulai = new Date(tanggalMulai);
    tglMulai.setHours(0, 0, 0, 0);
    const tglKadaluarsaSeharusnya = new Date(tglMulai);
    tglKadaluarsaSeharusnya.setDate(tglMulai.getDate() + paket.durasiHari); // Atur waktu ke akhir hari agar mencakup hari terakhir (disarankan)
    // Asumsi: Membership berakhir di akhir hari kadaluarsa
    tglKadaluarsaSeharusnya.setHours(23, 59, 59, 999); // Validasi apakah tanggalKadaluarsa yang dikirim sesuai dengan perhitungan
    const tglKadaluarsaInput = new Date(tanggalKadaluarsa);
    // Kita cek apakah tanggalKadaluarsaInput (diberi waktu 23:59) sama dengan tglKadaluarsaSeharusnya
    const tglKadaluarsaInputNormalized = new Date(tglKadaluarsaInput);
    tglKadaluarsaInputNormalized.setHours(23, 59, 59, 999);

    if (
      tglKadaluarsaInputNormalized.getTime() !==
      tglKadaluarsaSeharusnya.getTime()
    ) {
      // Tampilkan tanggal kadaluarsa tanpa bagian waktu
      const tglSeharusnyaString = tglKadaluarsaSeharusnya
        .toISOString()
        .split("T")[0];
      return res.status(400).json({
        message: "Tanggal Kadaluarsa tidak sesuai dengan durasi paket.",
        error: `Tanggal Kadaluarsa seharusnya: ${tglSeharusnyaString} (berdasarkan paket ${paket.durasiHari} hari).`,
      });
    } // --- Akhir Validasi Kustom ---
    const membership = await Membership.create(req.body);
    res.status(201).json({
      message: "Membership berhasil ditambahkan",
      data: membership,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ READ ALL (WAJIB FILTER berdasarkan tenantID) (REVISI VALIDASI)
// ===============================================
exports.getAllMembership = async (req, res) => {
  try {
    const { tenantID } = req.query; // Validasi ID format yang ketat

    if (!tenantID || !mongoose.Types.ObjectId.isValid(tenantID)) {
      return res.status(400).json({
        message:
          "Parameter tenantID wajib disertakan di query dan harus valid.",
      });
    }

    const membership = await Membership.find({ tenantID })
      .populate("PelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur")
      .sort({ tanggalMulai: -1 });

    if (membership.length === 0) {
      return res.status(404).json({
        message: "Tidak ada data Membership untuk tenant ini.",
      });
    }

    res.status(200).json(membership);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data Membership",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ READ BY ID (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.getMembershipById = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const membership = await Membership.findById(id)
      .populate("PelangganID", "namaPelanggan nomorHp")
      .populate("paketMembershipID", "namaPaket durasiHari")
      .populate("penjualanID", "nomorFaktur");

    if (!membership) {
      return res.status(404).json({
        message: "Membership tidak ditemukan.",
      });
    }
    res.status(200).json(membership);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Format ID tidak valid (CastError).",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Gagal mengambil data Membership",
      error: error.message,
    });
  }
};

// ===============================================
// ✅ UPDATE (REVISI KEAMANAN DAN VALIDASI)
// ===============================================
exports.updateMembership = async (req, res) => {
  try {
    const { id } = req.params;

    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    } // 1. Pengamanan: Hapus field yang tidak boleh diubah

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.tenantID; // Mencegah pemindahan dokumen antar tenant
    delete updateData.PelangganID; // ID Pelanggan tidak boleh diubah
    delete updateData.penjualanID; // ID Penjualan tidak boleh diubah

    // 2. KEAMANAN: Cek Field Asing/Tidak Dikenal
    const allowedFields = Object.keys(Membership.schema.paths);

    for (const key of Object.keys(updateData)) {
      if (!allowedFields.includes(key)) {
        return res.status(400).json({
          message: "Validasi gagal. Field tidak dikenal.",
          errors: {
            [key]: `Kolom '${key}' tidak ada dalam skema Membership.`,
          },
        });
      }
    }

    // 3. Validasi Logika Khusus (jika paketMembershipID atau tanggal diubah)
    if (
      updateData.paketMembershipID ||
      updateData.tanggalMulai ||
      updateData.tanggalKadaluarsa
    ) {
      // Logika bisnis membership seringkali kompleks.
      // Jika salah satu field terkait durasi diubah, kita harus validasi ulang.

      // Ambil data lama
      const currentMembership = await Membership.findById(id);
      if (!currentMembership) {
        return res.status(404).json({ message: "Membership tidak ditemukan." });
      }

      const newPaketID =
        updateData.paketMembershipID || currentMembership.paketMembershipID;
      const newTanggalMulai =
        updateData.tanggalMulai || currentMembership.tanggalMulai;
      const newTanggalKadaluarsa =
        updateData.tanggalKadaluarsa || currentMembership.tanggalKadaluarsa;

      const paket = await PaketMembership.findById(newPaketID);
      if (!paket) {
        return res
          .status(400)
          .json({ message: "Paket Membership baru tidak ditemukan." });
      }

      const tglMulai = new Date(newTanggalMulai);
      tglMulai.setHours(0, 0, 0, 0);

      const tglKadaluarsaSeharusnya = new Date(tglMulai);
      tglKadaluarsaSeharusnya.setDate(tglMulai.getDate() + paket.durasiHari);
      tglKadaluarsaSeharusnya.setHours(23, 59, 59, 999);

      const tglKadaluarsaInput = new Date(newTanggalKadaluarsa);
      const tglKadaluarsaInputNormalized = new Date(tglKadaluarsaInput);
      tglKadaluarsaInputNormalized.setHours(23, 59, 59, 999);

      if (
        tglKadaluarsaInputNormalized.getTime() !==
        tglKadaluarsaSeharusnya.getTime()
      ) {
        const tglSeharusnyaString = tglKadaluarsaSeharusnya
          .toISOString()
          .split("T")[0];
        return res.status(400).json({
          message:
            "Pembaruan gagal. Tanggal Kadaluarsa tidak sesuai dengan durasi paket.",
          error: `Tanggal Kadaluarsa seharusnya: ${tglSeharusnyaString} (berdasarkan paket ${paket.durasiHari} hari).`,
        });
      }
    }

    const membership = await Membership.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true, // Penting agar validasi kustom Mongoose berjalan saat update
      context: "query", // Diperlukan untuk validasi unique index
    });

    if (!membership) {
      return res.status(404).json({ message: "Membership tidak ditemukan" });
    }

    res.status(200).json({
      message: "Membership berhasil diperbarui",
      data: membership,
    });
  } catch (error) {
    const errorResponse = handleValidationError(error);
    res.status(400).json(errorResponse);
  }
};

// ===============================================
// ✅ DELETE (HANYA MENGGUNAKAN ID DARI PARAMS) (REVISI VALIDASI)
// ===============================================
exports.deleteMembership = async (req, res) => {
  try {
    const { id } = req.params;
    // Pre-check: Validasi ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const membership = await Membership.findByIdAndDelete(id);

    if (!membership) {
      return res.status(404).json({ message: "Membership tidak ditemukan" });
    } // NOTE: Di sini Anda mungkin perlu menambahkan logika bisnis

    // seperti membatalkan status member pada dokumen Pelanggan yang bersangkutan.

    res.status(200).json({ message: "Membership berhasil dihapus" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus Membership",
      error: error.message,
    });
  }
};
