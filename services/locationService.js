// locationService.js
const Location = require("../models/locationModel");
const mongoose = require("mongoose");
const createError = require("http-errors");
const { validateLocationPayload } = require("../validators/locationValidator");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

class LocationService {
  // Helper: Menangani Error Mongoose (Termasuk Unique Index)
  handleDbError(error, defaultMessage = "Gagal memproses data Lokasi") {
    if (error.code === 11000) {
      // Ini akan terpicu jika kita menambahkan index unique di model: { nama: 1, tenantID: 1 }
      return createError(400, {
        message: "Nama lokasi ini sudah digunakan oleh tenant Anda.",
      });
    }
    if (error.name === "ValidationError") {
      let errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return createError(400, {
        message: "Validasi data gagal. Cek detail errors.",
        errors: errors,
      });
    }
    if (error.name === "CastError") {
      return createError(400, { message: "Format ID tidak valid." });
    }
    return createError(500, error.message || defaultMessage);
  }

  // --- Helper: Cek Nama Lokasi Unik per Tenant ---
  async checkDuplicateName(tenantID, nama, excludeId = null) {
    const query = { tenantID, nama: new RegExp(`^${nama}$`, "i") };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const existingLocation = await Location.findOne(query);
    if (existingLocation) {
      throw createError(400, "Nama lokasi ini sudah ada di tenant Anda.");
    }
  }

  // --- CREATE ---
  async create(payload) {
    const validation = validateLocationPayload(payload, false);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      await this.checkDuplicateName(payload.tenantID, payload.nama); // Cek unik manual

      const newLocation = new Location(payload);
      const savedLocation = await newLocation.save();

      return savedLocation;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal menambahkan Lokasi.");
    }
  }

  // --- READ ALL ---
  async getAll(tenantID) {
    if (!tenantID || !isValidObjectId(tenantID))
      throw createError(400, "tenantID wajib disertakan dan harus valid.");

    try {
      const locations = await Location.find({ tenantID }).sort({ nama: 1 });

      if (locations.length === 0)
        throw createError(404, "Tidak ada data Lokasi untuk tenant ini.");

      return locations;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil daftar Lokasi.");
    }
  }

  // --- READ BY ID ---
  async getById(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Lokasi dan Tenant ID wajib disertakan dan harus valid."
      );

    try {
      // KEAMANAN KRITIS: Filter ID & tenantID
      const location = await Location.findOne({ _id: id, tenantID });

      if (!location)
        throw createError(
          404,
          "Lokasi tidak ditemukan atau Anda tidak memiliki akses."
        );

      return location;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal mengambil detail Lokasi.");
    }
  }

  // --- UPDATE ---
  async update(tenantID, id, payload) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Lokasi dan Tenant ID wajib disertakan dan harus valid."
      );

    const validation = validateLocationPayload(payload, true);
    if (!validation.valid)
      throw createError(400, {
        message: "Validasi gagal.",
        errors: validation.errors,
      });

    try {
      const updates = validation.updates;

      // Cek unik jika nama diubah
      if (updates.nama) {
        await this.checkDuplicateName(tenantID, updates.nama, id);
      }

      // Update DB: Hanya jika _id dan tenantID cocok
      const updatedLocation = await Location.findOneAndUpdate(
        { _id: id, tenantID: tenantID },
        updates,
        { new: true, runValidators: true }
      );

      if (!updatedLocation)
        throw createError(
          404,
          "Lokasi tidak ditemukan atau Anda tidak memiliki akses."
        );

      return updatedLocation;
    } catch (error) {
      if (createError.isHttpError(error)) throw error;
      throw this.handleDbError(error, "Gagal memperbarui Lokasi.");
    }
  }

  // --- DELETE ---
  async delete(tenantID, id) {
    if (!isValidObjectId(id) || !isValidObjectId(tenantID))
      throw createError(
        400,
        "ID Lokasi dan Tenant ID wajib disertakan dan harus valid."
      );

    // NOTE: Di dunia nyata, sebelum menghapus Lokasi, harus dicek apakah masih ada
    // TransferStok atau StokBahanBaku yang terkait dengan Lokasi ini.

    try {
      // KEAMANAN KRITIS: Delete hanya jika _id dan tenantID cocok
      const deletedLocation = await Location.findOneAndDelete({
        _id: id,
        tenantID: tenantID,
      });

      if (!deletedLocation)
        throw createError(
          404,
          "Lokasi tidak ditemukan atau Anda tidak memiliki akses."
        );

      return { message: "Lokasi berhasil dihapus" };
    } catch (error) {
      throw this.handleDbError(error, "Gagal menghapus Lokasi.");
    }
  }
}

module.exports = new LocationService();
