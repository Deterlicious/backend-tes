const Penjualan = require("../models/penjualanModel");
const Diskon = require("../models/diskonModel");
const Produk = require("../models/produkModel");
const SesiBooking = require("../models/sesiBookingModel");
const redis = require("../config/redis");
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
      return doc.map((d) => this._formatOutput(d));
    }

    if (doc.itemPenjualan && Array.isArray(doc.itemPenjualan)) {
      doc.itemPenjualan = doc.itemPenjualan.map((item) => {
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

  _generateNomorFaktur() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");
    return `INV/${yyyy}${mm}${dd}/${hh}${min}${ss}${ms}`;
  }

  _applyDiscountToItem(item, diskonObj) {
    item.hargaKotor = item.hargaJual * item.jumlah;

    let diskonVal = 0;
    let diskonIDToSave = null;

    if (diskonObj) {
      if (diskonObj.tipe === "persen") {
        diskonVal = (item.hargaKotor * diskonObj.nilai) / 100;
      } else {
        diskonVal = diskonObj.nilai;
      }

      if (diskonVal > item.hargaKotor) diskonVal = item.hargaKotor;
      diskonIDToSave = diskonObj._id;
    }

    item.diskonID = diskonIDToSave;
    item.jumlahDiskon = Math.ceil(diskonVal);
    item.subtotal = Math.ceil(item.hargaKotor - diskonVal);
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
      await redis.set(key, JSON.stringify(formatted), "EX", 60);
    }
    return formatted;
  }

  async getById(id, requesterTenantID) {
    const key = CACHE_KEY_DETAIL(id);
    const cached = await redis.get(key);
    
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.tenantID !== requesterTenantID.toString()) return null;
      return parsed;
    }

    const penjualan = await Penjualan.findOne({ _id: id, tenantID: requesterTenantID })
      .populate("dataPelanggan", "namaPelanggan tipePelanggan alamat email")
      .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai")
      .lean();

    if (!penjualan) return null;
    const formatted = this._formatOutput(penjualan);
    await redis.set(key, JSON.stringify(formatted), "EX", 60);
    return formatted;
  }

  async create(payload) {
    const validation = validatePenjualanPayload(payload);
    if (!validation.valid) return { error: validation.errors };

    try {
      if (payload.itemPenjualan && payload.itemPenjualan.length > 0) {
        for (const item of payload.itemPenjualan) {
          if (item.produkID) {
            const produkData = await Produk.findOne({ _id: item.produkID, tenantID: payload.tenantID });
            if (!produkData) {
              return { error: [`Produk ID ${item.produkID} tidak ditemukan atau akses ditolak.`] };
            }
            
            if (!item.namaProduk) item.namaProduk = produkData.namaProduk;
            if (item.hargaJual === undefined || item.hargaJual === null) {
              item.hargaJual = produkData.hargaJual;
            }
          }
          if (item.dataDiskon) {
            item.diskonID = item.dataDiskon;
            delete item.dataDiskon;
          }
          const qty = item.jumlah || 1;
          const hrg = item.hargaJual || 0;
          item.hargaKotor = qty * hrg;
        }
        await this._validateDiskonItems(payload.itemPenjualan, payload.tenantID);
      }

      if (!payload.nomorFaktur) payload.nomorFaktur = this._generateNomorFaktur();
      if (!payload.statusPembayaran) payload.statusPembayaran = "UNPAID";

      const newPenjualan = await Penjualan.create(payload);
      await redis.del(CACHE_KEY_LIST(payload.tenantID));

      const result = await Penjualan.findById(newPenjualan._id)
        .populate("dataPelanggan", "namaPelanggan tipePelanggan")
        .populate("itemPenjualan.diskonID", "namaDiskon tipe nilai")
        .lean();

      return this._formatOutput(result);
    } catch (err) {
      if (err.code === 11000) {
        return {
          error: ["Gagal membuat faktur: Nomor Faktur duplikat. Coba lagi."],
        };
      }
      throw err;
    }
  }

  async update(id, payload, requestedTenantID) {
    if (payload.itemPenjualan) {
      const validation = validatePenjualanPayload(payload, true);
      if (!validation.valid) return { error: validation.errors };
    }

    delete payload.tenantID;
    delete payload._id;

    try {
      const currentData = await Penjualan.findOne({ _id: id, tenantID: requestedTenantID });
      if (!currentData) return null;

      if (payload.dataDiskon !== undefined) {
        let diskonObj = null;

        if (payload.dataDiskon) {
          diskonObj = await Diskon.findOne({ _id: payload.dataDiskon, tenantID: requestedTenantID });
          if (!diskonObj || diskonObj.status !== "Aktif") {
            return {
              error: ["Diskon Global tidak ditemukan atau tidak aktif"],
            };
          }
        }

        if (currentData.itemPenjualan && currentData.itemPenjualan.length > 0) {
          currentData.itemPenjualan.forEach((item) => {
            this._applyDiscountToItem(item, diskonObj);
          });
          currentData.markModified("itemPenjualan");
        }
        delete payload.dataDiskon;
      }

      if (payload.itemPenjualan && Array.isArray(payload.itemPenjualan)) {
        for (const inputItem of payload.itemPenjualan) {
          if (inputItem.sesiBookingID && inputItem.dataDiskon !== undefined) {
            const targetItem = currentData.itemPenjualan.find(
              (dbItem) =>
                dbItem.sesiBookingID &&
                dbItem.sesiBookingID.toString() === inputItem.sesiBookingID
            );

            if (targetItem) {
              let specificDiskonObj = null;
              if (inputItem.dataDiskon) {
                specificDiskonObj = await Diskon.findOne({ _id: inputItem.dataDiskon, tenantID: requestedTenantID });
                if (!specificDiskonObj || specificDiskonObj.status !== "Aktif") {
                  return {
                    error: [
                      `Diskon Spesifik (ID: ${inputItem.dataDiskon}) tidak valid.`,
                    ],
                  };
                }
              }
              this._applyDiscountToItem(targetItem, specificDiskonObj);
            }
          }
        }
        currentData.markModified("itemPenjualan");
      }

      delete payload.itemPenjualan;
      Object.assign(currentData, payload);

      let grandTotal = 0;
      if (currentData.itemPenjualan) {
        currentData.itemPenjualan.forEach((item) => {
          grandTotal += item.subtotal || 0;
        });
      }
      currentData.totalHarga = grandTotal;

      if (currentData.statusPembayaran === "UNPAID") {
        currentData.sisaTagihan = grandTotal;
      }

      await currentData.save();

      if (currentData.jenisPenjualan === "booking" && currentData.itemPenjualan) {
        for (const item of currentData.itemPenjualan) {
          if (item.sesiBookingID) {
            await SesiBooking.findByIdAndUpdate(item.sesiBookingID, {
              totalBiaya: item.subtotal,
            });
            await redis.del(`booking:detail:${item.sesiBookingID}`);
          }
        }
        await redis.del(CACHE_KEY_BOOKING_LIST(currentData.tenantID));
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

  async delete(id, requesterTenantID) {
    const result = await Penjualan.deleteOne({ _id: id, tenantID: requesterTenantID });
    if (result.deletedCount === 0) return null;
    
    await redis.del(CACHE_KEY_LIST(requesterTenantID));
    await redis.del(CACHE_KEY_DETAIL(id));
    return true;
  }

  async _validateDiskonItems(items, tenantID) {
    if (!items || items.length === 0) return;
    for (const [index, item] of items.entries()) {
      if (item.diskonID) {
        const diskon = await Diskon.findOne({ _id: item.diskonID, tenantID });
        if (!diskon || diskon.status === "Non-Aktif") {
          throw createError(
            400,
            `Item #${index + 1}: Diskon tidak valid atau Non-Aktif.`
          );
        }
      }
    }
  }
}

module.exports = new PenjualanService();