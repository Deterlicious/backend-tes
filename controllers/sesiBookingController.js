const SesiBooking = require("../models/sesiBookingModel");
const mongoose = require("mongoose");
// Pastikan path redisClient sesuai
const redis = require("../utils/redisClient");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// --- Helper: Cache Keys ---
const keyBookingList = (tenantID) => `booking:tenant:${tenantID}`;
const keyBookingDetail = (id) => `booking:detail:${id}`;

exports.createBooking = async (req, res) => {
  try {
    const {
      penjualanID,
      asetID,
      waktuMulai,
      waktuSelesai,
      status,
      totalBiaya,
      penggunaID,
      tenantID,
    } = req.body;

    // 1. Validasi Input Wajib
    if (!penjualanID || !asetID || !waktuMulai || !penggunaID || !tenantID) {
      return res.status(400).json({ 
        message: "Field wajib: penjualanID, asetID, waktuMulai, penggunaID, tenantID" 
      });
    }

    // 2. Validasi ObjectId
    if (!isValidObjectId(asetID) || !isValidObjectId(tenantID) || !isValidObjectId(penjualanID)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const start = new Date(waktuMulai);
    
    // 3. Validasi Waktu Selesai (Jika ada)
    if (waktuSelesai) {
      const end = new Date(waktuSelesai);
      if (end <= start) {
        return res.status(400).json({ message: "Waktu selesai harus setelah waktu mulai." });
      }

      // 4. CEK BENTROK JADWAL (Conflict Detection)
      // Logika: Cari booking lain untuk aset yg sama, status Aktif, dan waktunya beririsan
      const conflict = await SesiBooking.findOne({
        asetID,
        status: "Aktif",
        $or: [
          // (StartA <= EndB) and (EndA >= StartB)
          {
            waktuMulai: { $lt: end },
            waktuSelesai: { $gt: start },
          },
        ],
      });

      if (conflict) {
        return res.status(409).json({ 
          message: "Aset sedang digunakan atau sudah di-booking pada jam tersebut." 
        });
      }
    }

    const newBooking = new SesiBooking({
      penjualanID,
      asetID,
      waktuMulai,
      waktuSelesai,
      status: status || "Aktif",
      totalBiaya,
      penggunaID,
      tenantID,
    });

    await newBooking.save();

    // 5. Cache Invalidation
    await redis.del(keyBookingList(tenantID));

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllBooking = async (req, res) => {
  try {
    const { tenantID } = req.query;

    if (!tenantID) {
      return res.status(400).json({ message: "tenantID wajib disertakan." });
    }

    // 1. Cek Cache
    const cacheKey = keyBookingList(tenantID);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const bookings = await SesiBooking.find({ tenantID })
      .populate("asetID", "namaAset status")
      .populate("penggunaID", "nama")
      .populate("penjualanID", "nomorTransaksi")
      .sort({ waktuMulai: -1 }); // Urutkan dari jadwal terbaru

    // 3. Simpan Cache (Expire 30 detik agar status availability cepat update)
    await redis.setEx(cacheKey, 30, JSON.stringify(bookings));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Cek Cache Detail
    const cacheKey = keyBookingDetail(id);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // 2. Ambil dari DB
    const booking = await SesiBooking.findById(id)
      .populate("asetID")
      .populate("penggunaID")
      .populate("penjualanID");

    if (!booking)
      return res.status(404).json({ message: "Booking tidak ditemukan" });

    // 3. Simpan Cache
    await redis.setEx(cacheKey, 60, JSON.stringify(booking));

    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    // 1. Validasi Field (Whitelisting)
    const allowedUpdates = ["waktuMulai", "waktuSelesai", "status", "totalBiaya"];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) updates[key] = req.body[key];
    });

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Tidak ada data valid untuk diupdate" });
    }

    // Validasi Logika Waktu jika ada perubahan
    if (updates.waktuMulai || updates.waktuSelesai) {
        const currentBooking = await SesiBooking.findById(id);
        if(!currentBooking) return res.status(404).json({ message: "Booking tidak ditemukan" });

        const start = updates.waktuMulai ? new Date(updates.waktuMulai) : new Date(currentBooking.waktuMulai);
        const end = updates.waktuSelesai ? new Date(updates.waktuSelesai) : new Date(currentBooking.waktuSelesai);

        if (end && end <= start) {
            return res.status(400).json({ message: "Waktu selesai harus setelah waktu mulai." });
        }
        
        // Hitung ulang durasi menit manual jika update tidak mentrigger save hook
        if(end) {
            const diffMs = end - start;
            updates.durasiMenit = Math.ceil(diffMs / (1000 * 60));
        }
    }

    // 2. Update DB
    const updatedBooking = await SesiBooking.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedBooking)
      return res.status(404).json({ message: "Booking tidak ditemukan" });

    // 3. Cache Invalidation
    await redis.del(keyBookingDetail(id));
    await redis.del(keyBookingList(updatedBooking.tenantID));

    res.status(200).json(updatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Format ID tidak valid." });
    }

    const booking = await SesiBooking.findById(id);
    if (!booking)
      return res.status(404).json({ message: "Booking tidak ditemukan" });

    // 1. Hapus DB
    await SesiBooking.findByIdAndDelete(id);

    // 2. Cache Invalidation
    await redis.del(keyBookingDetail(id));
    await redis.del(keyBookingList(booking.tenantID));

    res.status(200).json({ message: "Booking berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};