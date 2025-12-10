const SesiBooking = require("../models/sesiBookingModel");
const Penjualan = require("../models/penjualanModel");
const Aset = require("../models/asetModel");
const Tarif = require("../models/tarifModel");
const Diskon = require("../models/diskonModel");
const redis = require("../utils/redisClient");
const { validateSesiBookingPayload } = require("../validators/sesiBookingValidator");
const mongoose = require("mongoose");
const createError = require("http-errors");

const CACHE_KEY_LIST = (tenantID) => `booking:tenant:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `booking:detail:${id}`;

class SesiBookingService {
  _generateNomorFaktur() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const datePart = `${yyyy}${mm}${dd}`;

    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    const timePart = `${hh}${min}${ss}${ms}`;

    return `INV/${datePart}/${timePart}`;
  }

  async _calculateCost(tenantID, asetID, durasiMenit) {
    const asset = await Aset.findById(asetID);
    if (!asset) throw createError(404, "Aset tidak ditemukan saat hitung biaya.");

    const tarif = await Tarif.findOne({
      tenantID: tenantID,
      tipeAsetID: asset.tipeAsetID,
    });

    if (!tarif) {
      throw createError(400, `Tarif belum diatur untuk tipe aset: ${asset.namaAset}`);
    }

    let hargaKotor = 0;

    if (tarif.basisPerhitungan === "per sesi") {
      hargaKotor = tarif.harga;
    } else if (tarif.basisPerhitungan === "per jam") {
      const durasiJam = durasiMenit / 60;
      const durasiKalkulasi = Math.max(durasiJam, tarif.durasiMinimum);
      hargaKotor = durasiKalkulasi * tarif.harga;
    }

    return Math.ceil(hargaKotor);
  }

  async _calculateDiscount(diskonID, hargaKotor) {
    if (!diskonID) return { nilaiPotongan: 0, diskonObj: null };

    const diskon = await Diskon.findById(diskonID);
    if (!diskon || diskon.status !== "Aktif") {
      throw createError(400, "Diskon tidak valid atau tidak aktif.");
    }

    let nilaiPotongan = 0;
    if (diskon.tipe === "persen") {
      nilaiPotongan = (hargaKotor * diskon.nilai) / 100;
    } else {
      nilaiPotongan = diskon.nilai;
    }

    if (nilaiPotongan > hargaKotor) nilaiPotongan = hargaKotor;

    return { nilaiPotongan: Math.ceil(nilaiPotongan), diskonObj: diskon };
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const bookings = await SesiBooking.find({ tenantID })
      .populate("dataAset", "namaAset status")
      .populate("penggunaID", "nama")
      .populate("dataPelanggan", "namaPelanggan tipePelanggan")
      .populate({
        path: "dataPenjualan",
        select: "nomorFaktur statusPembayaran totalHarga dataPelanggan",
        populate: {
          path: "dataPelanggan",
          select: "namaPelanggan tipePelanggan",
        },
      })
      .sort({ waktuMulai: -1 })
      .lean();

    if (bookings.length > 0) {
      await redis.setEx(key, 60, JSON.stringify(bookings));
    }

    return bookings;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const booking = await SesiBooking.findById(id)
      .populate("dataAset")
      .populate("penggunaID")
      .populate("dataPelanggan", "namaPelanggan tipePelanggan")
      .populate({
        path: "dataPenjualan",
        populate: [
          { path: "itemPenjualan.produkID", select: "namaProduk" },
          { path: "dataPelanggan", select: "namaPelanggan tipePelanggan" },
          { path: "itemPenjualan.diskonID", select: "namaDiskon code nilai tipe" },
        ],
      })
      .lean();

    if (!booking) return null;

    await redis.setEx(key, 60, JSON.stringify(booking));
    return booking;
  }

  async create(payload) {
    const validation = validateSesiBookingPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      const targetAset = await Aset.findById(payload.dataAset);

      if (!targetAset) {
        return { error: ["Aset tidak ditemukan."] };
      }

      if (targetAset.tenantID.toString() !== payload.tenantID.toString()) {
        return { error: ["Akses Ditolak: Aset ini bukan milik tenant Anda."] };
      }

      if (payload.waktuSelesai) {
        const isConflict = await this._checkConflict(
          payload.dataAset,
          payload.waktuMulai,
          payload.waktuSelesai
        );
        if (isConflict)
          return { error: ["Aset sedang digunakan pada jam tersebut."] };
      }

      const start = new Date(payload.waktuMulai);
      const end = payload.waktuSelesai ? new Date(payload.waktuSelesai) : null;

      let durasiMenit = 0;
      let hargaKotor = 0;
      let jumlahDiskon = 0;
      let totalBiaya = 0;

      let diskonID = payload.dataDiskon || null;

      if (end) {
        const diffMs = end - start;
        durasiMenit = Math.ceil(diffMs / (1000 * 60));

        try {
          hargaKotor = await this._calculateCost(
            payload.tenantID,
            payload.dataAset,
            durasiMenit
          );

          if (diskonID) {
            const diskonResult = await this._calculateDiscount(diskonID, hargaKotor);
            jumlahDiskon = diskonResult.nilaiPotongan;
          }

          totalBiaya = hargaKotor - jumlahDiskon;
        } catch (calcError) {
          return { error: [calcError.message] };
        }
      }

      const newPenjualanId = new mongoose.Types.ObjectId();
      const newBookingId = new mongoose.Types.ObjectId();
      const namaItemJual = `Sewa ${targetAset.namaAset}`;

      const itemPenjualanData = {
        produkID: payload.produkID || new mongoose.Types.ObjectId(),
        jumlah: 1,
        namaProduk: namaItemJual,
        hargaJual: totalBiaya,
        hargaKotor: hargaKotor,
        jumlahDiskon: jumlahDiskon,
        subtotal: totalBiaya,
        diskonID: diskonID,
        sesiBookingID: newBookingId,
      };

      const nomorFakturBaru = this._generateNomorFaktur();

      const newPenjualan = new Penjualan({
        _id: newPenjualanId,
        tanggalPenjualan: null,
        nomorFaktur: nomorFakturBaru,
        jenisPenjualan: "booking",
        totalHarga: totalBiaya,
        dataPelanggan: payload.dataPelanggan,
        itemPenjualan: [itemPenjualanData],
        tenantID: payload.tenantID,
        statusPembayaran: "UNPAID",
        sisaTagihan: totalBiaya,
      });

      const newBooking = new SesiBooking({
        _id: newBookingId,
        dataPenjualan: newPenjualanId,
        dataAset: payload.dataAset,
        penggunaID: payload.penggunaID,
        tenantID: payload.tenantID,
        dataPelanggan: payload.dataPelanggan,
        waktuMulai: payload.waktuMulai,
        waktuSelesai: payload.waktuSelesai,
        durasiMenit: durasiMenit,
        totalBiaya: totalBiaya,
        status: payload.status || "Aktif",
      });

      await newPenjualan.save();
      await newBooking.save();

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      const result = await SesiBooking.findById(newBookingId)
        .populate("dataAset", "namaAset")
        .populate("dataPelanggan", "namaPelanggan tipePelanggan")
        .populate({
          path: "dataPenjualan",
          populate: {
            path: "dataPelanggan",
            select: "namaPelanggan tipePelanggan",
          },
        })
        .lean();

      return result;
    } catch (err) {
      throw err;
    }
  }

  async update(id, payload) {
    const validation = validateSesiBookingPayload(payload, true);
    if (!validation.valid) return { error: validation.errors };

    delete payload.tenantID;
    delete payload.penggunaID;
    delete payload.dataPenjualan;

    try {
      const currentBooking = await SesiBooking.findById(id);
      if (!currentBooking) return null;

      if (payload.dataAset) {
        const targetAset = await Aset.findById(payload.dataAset);
        if (!targetAset) return { error: ["Aset tidak ditemukan."] };
        if (targetAset.tenantID.toString() !== currentBooking.tenantID.toString()) {
          return { error: ["Akses Ditolak: Aset ini bukan milik tenant Anda."] };
        }
      }

      const start = payload.waktuMulai ? new Date(payload.waktuMulai) : currentBooking.waktuMulai;
      const end = payload.waktuSelesai ? new Date(payload.waktuSelesai) : currentBooking.waktuSelesai;

      if (end && end <= start) {
        return { error: ["Waktu selesai harus setelah waktu mulai."] };
      }

      if (payload.waktuMulai || payload.waktuSelesai || payload.dataAset || payload.dataDiskon !== undefined) {
        const asetToCheck = payload.dataAset || currentBooking.dataAset;
        const conflict = await SesiBooking.findOne({
          _id: { $ne: id },
          dataAset: asetToCheck,
          status: "Aktif",
          $or: [{ waktuMulai: { $lt: end }, waktuSelesai: { $gt: start } }],
        });

        if (conflict) return { error: ["Aset bentrok dengan jadwal lain."] };

        const diffMs = end - start;
        payload.durasiMenit = Math.ceil(diffMs / (1000 * 60));

        try {
          const hargaKotor = await this._calculateCost(
            currentBooking.tenantID,
            asetToCheck,
            payload.durasiMenit
          );

          let diskonID = null;
          let jumlahDiskon = 0;

          if (payload.dataDiskon) {
            diskonID = payload.dataDiskon;
          } else if (payload.dataDiskon === null) {
            diskonID = null;
          } else {
            const existingPenjualan = await Penjualan.findById(currentBooking.dataPenjualan);
            if (existingPenjualan && existingPenjualan.itemPenjualan[0]) {
              diskonID = existingPenjualan.itemPenjualan[0].diskonID;
            }
          }

          if (diskonID) {
            const diskonResult = await this._calculateDiscount(diskonID, hargaKotor);
            jumlahDiskon = diskonResult.nilaiPotongan;
          }

          const totalBiaya = hargaKotor - jumlahDiskon;
          payload.totalBiaya = totalBiaya;

          if (currentBooking.dataPenjualan) {
            await Penjualan.findByIdAndUpdate(currentBooking.dataPenjualan, {
              totalHarga: totalBiaya,
              sisaTagihan: totalBiaya,
              $set: {
                "itemPenjualan.0.hargaJual": totalBiaya,
                "itemPenjualan.0.hargaKotor": hargaKotor,
                "itemPenjualan.0.jumlahDiskon": jumlahDiskon,
                "itemPenjualan.0.subtotal": totalBiaya,
                "itemPenjualan.0.diskonID": diskonID,
              },
            });
          }
        } catch (calcError) {
          return { error: [calcError.message] };
        }
      }

      const updated = await SesiBooking.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      }).lean();

      await redis.del(CACHE_KEY_LIST(updated.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      return updated;
    } catch (err) {
      throw err;
    }
  }

  async delete(id) {
    const target = await SesiBooking.findById(id).lean();
    if (!target) return null;
    await SesiBooking.deleteOne({ _id: id });
    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));
    return true;
  }

  async _checkConflict(asetID, startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const conflict = await SesiBooking.findOne({
      dataAset: asetID,
      status: "Aktif",
      $or: [
        { waktuMulai: { $lt: end }, waktuSelesai: { $gt: start } },
      ],
    });
    return !!conflict;
  }

  async createBatch(payload) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return { error: ["Daftar item booking (items) wajib diisi."] };
    }

    try {
      const newPenjualanId = new mongoose.Types.ObjectId();
      let totalBiayaGlobal = 0;
      const itemPenjualanList = [];
      const bookingDocs = [];

      for (const [index, item] of payload.items.entries()) {

        if (!item.dataAset || !item.waktuMulai) {
          throw new Error(`Item #${index + 1}: dataAset dan waktuMulai wajib diisi.`);
        }

        const targetAset = await Aset.findById(item.dataAset);
        if (!targetAset) throw new Error(`Item #${index + 1}: Aset tidak ditemukan.`);

        if (targetAset.tenantID.toString() !== payload.tenantID.toString()) {
          throw new Error(`Item #${index + 1}: Aset bukan milik tenant ini.`);
        }

        const isConflict = await this._checkConflict(
          item.dataAset,
          item.waktuMulai,
          item.waktuSelesai
        );

        if (isConflict) {
          throw new Error(`Item #${index + 1}: Aset ${targetAset.namaAset} bentrok pada jam tersebut.`);
        }

        const start = new Date(item.waktuMulai);
        const end = item.waktuSelesai ? new Date(item.waktuSelesai) : null;
        let durasiMenit = 0;
        let hargaKotor = 0;
        let jumlahDiskon = 0;
        let totalItem = 0;

        const diskonID = item.dataDiskon || null;

        if (end) {
          const diffMs = end - start;
          durasiMenit = Math.ceil(diffMs / (1000 * 60));

          hargaKotor = await this._calculateCost(
            payload.tenantID,
            item.dataAset,
            durasiMenit
          );

          if (diskonID) {
            const diskonRes = await this._calculateDiscount(diskonID, hargaKotor);
            jumlahDiskon = diskonRes.nilaiPotongan;
          }

          totalItem = hargaKotor - jumlahDiskon;
        }

        totalBiayaGlobal += totalItem;

        const newBookingId = new mongoose.Types.ObjectId();

        itemPenjualanList.push({
          produkID: item.produkID || new mongoose.Types.ObjectId(),
          namaProduk: `Sewa ${targetAset.namaAset}`,
          jumlah: 1,
          hargaJual: totalItem,
          hargaKotor: hargaKotor,
          jumlahDiskon: jumlahDiskon,
          subtotal: totalItem,
          diskonID: diskonID,
          sesiBookingID: newBookingId
        });

        bookingDocs.push({
          _id: newBookingId,
          tenantID: payload.tenantID,
          penggunaID: payload.penggunaID,
          dataPelanggan: payload.dataPelanggan,
          dataAset: item.dataAset,
          dataPenjualan: newPenjualanId,
          waktuMulai: item.waktuMulai,
          waktuSelesai: item.waktuSelesai,
          durasiMenit: durasiMenit,
          totalBiaya: totalItem,
          status: "Aktif"
        });
      }

      const nomorFakturBaru = this._generateNomorFaktur();

      const newPenjualan = new Penjualan({
        _id: newPenjualanId,
        tenantID: payload.tenantID,
        nomorFaktur: nomorFakturBaru,
        jenisPenjualan: "booking",
        dataPelanggan: payload.dataPelanggan,
        itemPenjualan: itemPenjualanList,
        totalHarga: totalBiayaGlobal,
        sisaTagihan: totalBiayaGlobal,
        statusPembayaran: "UNPAID"
      });

      await newPenjualan.save();
      await SesiBooking.insertMany(bookingDocs);

      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      return {
        message: "Batch booking berhasil",
        penjualanID: newPenjualanId,
        totalBookings: bookingDocs.length,
        nomorFaktur: nomorFakturBaru
      };

    } catch (error) {
      return { error: [error.message] };
    }
  }
}

module.exports = new SesiBookingService();