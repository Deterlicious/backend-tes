const Penjualan = require("../models/penjualanModel");
const Diskon = require("../models/diskonModel");
const Produk = require("../models/produkModel");
const SesiBooking = require("../models/sesiBookingModel"); 
const redis = require("../utils/redisClient");
const { validatePenjualanPayload } = require("../validators/penjualanValidator");
const createError = require("http-errors");
const mongoose = require("mongoose");

const CACHE_KEY_LIST = (tenantID) => `penjualan:tenant:${tenantID}`;
const CACHE_KEY_DETAIL = (id) => `penjualan:detail:${id}`;
const CACHE_KEY_BOOKING_LIST = (tenantID) => `booking:tenant:${tenantID}`; 

class PenjualanService {
  
  _formatOutput(doc) {
    if (!doc) return null;
    if (Array.isArray(doc)) {
      return doc.map(d => this._formatOutput(d));
    }
    
    if (doc.itemPenjualan && Array.isArray(doc.itemPenjualan)) {
      doc.itemPenjualan = doc.itemPenjualan.map(item => {
        if (item.diskonID) {
          item.dataDiskon = item.diskonID;
          delete item.diskonID; 
        } else {
          item.dataDiskon = null;
        }
        return item;
      });
    }
    return doc;
  }

  async getAll(tenantID) {
    if (!tenantID) throw createError(400, "tenantID is required");

    const key = CACHE_KEY_LIST(tenantID);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const penjualans = await Penjualan.find({ tenantID })
      .populate("dataPelanggan", "namaPelanggan tipePelanggan nomorHp")
      .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai") 
      .sort({ createdAt: -1 })
      .lean();

    const formatted = this._formatOutput(penjualans); 

    if (formatted.length > 0) {
      await redis.setEx(key, 60, JSON.stringify(formatted));
    }

    return formatted;
  }

  async getById(id) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const penjualan = await Penjualan.findById(id)
      .populate("dataPelanggan", "namaPelanggan tipePelanggan alamat email")
      .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai")
      .lean();

    if (!penjualan) return null;

    const formatted = this._formatOutput(penjualan); 

    await redis.setEx(key, 60, JSON.stringify(formatted));
    return formatted;
  }

  async create(payload) {
    const validation = validatePenjualanPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      if (payload.itemPenjualan && payload.itemPenjualan.length > 0) {
        for (const item of payload.itemPenjualan) {
          if (item.produkID) {
            const produkData = await Produk.findById(item.produkID);
            if (!produkData) return { error: [`Produk ID ${item.produkID} tidak ditemukan.`] };
            if (produkData.tenantID.toString() !== payload.tenantID.toString()) {
              return { error: [`Produk "${produkData.namaProduk}" bukan milik tenant ini.`] };
            }
            if (!item.namaProduk) item.namaProduk = produkData.namaProduk;
            
            if (item.hargaJual === undefined || item.hargaJual === null) {
              item.hargaJual = produkData.hargaJual;
            }
          }
          const qty = item.jumlah || 1;
          const hrg = item.hargaJual || 0;
          item.hargaKotor = qty * hrg;
        }
        // Kirim tenantID ke validator
        await this._validateDiskonItems(payload.itemPenjualan, payload.tenantID);
      }

      if (!payload.nomorFaktur) payload.nomorFaktur = `POS-${Date.now()}`;
      if (!payload.statusPembayaran) payload.statusPembayaran = "UNPAID";

      const newPenjualan = await Penjualan.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      const result = await Penjualan.findById(newPenjualan._id)
        .populate("dataPelanggan", "namaPelanggan tipePelanggan")
        .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai")
        .lean();

      return this._formatOutput(result);
    } catch (err) {
      if (err.code === 11000) return { error: ["Nomor Faktur sudah terdaftar."] };
      throw err;
    }
  }

  async update(id, payload) {
    if (payload.itemPenjualan) {
        const validation = validatePenjualanPayload(payload, true);
        if (!validation.valid) return { error: validation.errors };
    }
    
    delete payload.tenantID;
    delete payload._id;

    try {
      const currentData = await Penjualan.findById(id);
      if (!currentData) return null;

      // === LOGIC UPDATE DISKON (via root payload) ===
      if (payload.diskonID !== undefined) {
        if (currentData.itemPenjualan && currentData.itemPenjualan.length > 0) {
            const targetItem = currentData.itemPenjualan[0]; 
            targetItem.hargaKotor = targetItem.hargaJual * targetItem.jumlah;

            let diskonVal = 0;
            let diskonIDToSave = null;

            if (payload.diskonID) {
                const diskon = await Diskon.findById(payload.diskonID);
                
                if (!diskon || diskon.status !== "Aktif") {
                    return { error: ["Diskon tidak ditemukan atau tidak aktif"] };
                }

                // --- SECURITY CHECK: Pastikan Diskon milik Tenant ini ---
                if (diskon.tenantID.toString() !== currentData.tenantID.toString()) {
                     return { error: ["Akses Ditolak: Diskon ini bukan milik tenant Anda."] };
                }
                // --------------------------------------------------------
                
                if (diskon.tipe === 'persen') {
                    diskonVal = (targetItem.hargaKotor * diskon.nilai) / 100;
                } else {
                    diskonVal = diskon.nilai;
                }
                
                if (diskonVal > targetItem.hargaKotor) diskonVal = targetItem.hargaKotor;
                diskonIDToSave = diskon._id;
            } else {
                diskonVal = 0;
                diskonIDToSave = null;
            }

            targetItem.diskonID = diskonIDToSave;
            targetItem.jumlahDiskon = Math.ceil(diskonVal);
            targetItem.subtotal = Math.ceil(targetItem.hargaKotor - diskonVal);

            currentData.markModified('itemPenjualan');
        }
        delete payload.diskonID;
      }

      // === LOGIC UPDATE ITEM BIASA ===
      if (payload.itemPenjualan) {
        // Kirim tenantID dari data yang sedang diedit ke validator
        await this._validateDiskonItems(payload.itemPenjualan, currentData.tenantID);
      }

      Object.assign(currentData, payload);
      
      let grandTotal = 0;
      if (currentData.itemPenjualan) {
         currentData.itemPenjualan.forEach(item => {
             grandTotal += (item.subtotal || 0);
         });
      }
      currentData.totalHarga = grandTotal;

      if (currentData.statusPembayaran === 'UNPAID') {
          currentData.sisaTagihan = grandTotal;
      }

      await currentData.save();

      if (currentData.jenisPenjualan === 'booking') {
        const relatedBooking = await SesiBooking.findOne({ dataPenjualan: id });
        
        if (relatedBooking) {
            relatedBooking.totalBiaya = currentData.totalHarga;
            await relatedBooking.save();

            await redis.del(CACHE_KEY_BOOKING_LIST(currentData.tenantID));
            await redis.del(`booking:detail:${relatedBooking._id}`);
        }
      }

      await redis.del(CACHE_KEY_LIST(currentData.tenantID));
      await redis.del(CACHE_KEY_DETAIL(id));

      const updatedResult = await Penjualan.findById(id)
        .populate("dataPelanggan", "namaPelanggan tipePelanggan")
        .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai")
        .lean();

      return this._formatOutput(updatedResult);
    } catch (err) {
      throw err;
    }
  }

  async delete(id) {
    const target = await Penjualan.findById(id).lean();
    if (!target) return null;
    await Penjualan.deleteOne({ _id: id });
    await redis.del(CACHE_KEY_LIST(target.tenantID));
    await redis.del(CACHE_KEY_DETAIL(id));
    return true;
  }

  // --- Helper: Validate items array ---
  async _validateDiskonItems(items, tenantID) {
    if (!items || items.length === 0) return;
    for (const [index, item] of items.entries()) {
      if (item.diskonID) {
        const diskon = await Diskon.findById(item.diskonID);
        if (!diskon || diskon.status === "Non-Aktif") {
          throw createError(
            400,
            `Item #${index + 1}: Diskon tidak valid atau Non-Aktif.`
          );
        }
        
        // --- SECURITY CHECK ---
        if (tenantID && diskon.tenantID.toString() !== tenantID.toString()) {
             throw createError(
                403,
                `Item #${index + 1}: Diskon "${diskon.namaDiskon}" bukan milik tenant Anda.`
             );
        }
      }
    }
  }
}

module.exports = new PenjualanService();