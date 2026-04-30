// const tenantService = require("../services/tenantService");
// const akunService = require("../services/akunService");
// const createError = require("http-errors");

// // Helper cookie refresh token
// const setRefreshTokenCookie = (res, token) => {
//   res.cookie("refreshToken", token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "strict",
//     path: "/api/akun/auth",
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//   });
// };

// class TenantController {

//   // get tenant
//   async getAll(req, res, next) {
//     try {
//       const tenants = await tenantService.getAll();

//       const formatted = tenants.map((t) => ({
//         _id: t._id,
//         namaToko: t.namaToko,
//         emailBisnis: t.emailBisnis,
//         nomorTelepon: t.nomorTelepon,
//         alamat: t.alamat,
//         kota: t.kota,
//         kodePos: t.kodePos,
//         persenPajak: t.persenPajak,
//         tipePajak: t.tipePajak,
//         idNPWP: t.idNPWP,
//         logoUrl: t.logoUrl,
//         footerStruk: t.footerStruk,
//         status: t.status,
//         isSetupComplete: t.isSetupComplete,
//       }));

//       res.json({
//         message: "Daftar toko berhasil diambil.",
//         total: formatted.length,
//         data: formatted,
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // get tenant by id pakai rba dan isolasi tenant
//   async getById(req, res, next) {
//     try {
//       const tenantID = req.pengguna?.tenantID;
//       const targetId = req.params.id;

//       if (!tenantID) {
//         throw createError(400, "Tenant tidak ditemukan pada pengguna.");
//       }

//       // Isolasi tenant
//       if (tenantID.toString() !== targetId) {
//         throw createError(403, "Akses ditolak ke tenant ini.");
//       }

//       const t = await tenantService.getById(targetId);
//       if (!t) throw createError(404, "Tenant tidak ditemukan.");

//       res.json({
//         message: "Detail toko berhasil diambil.",
//         data: {
//           _id: t._id,
//           namaToko: t.namaToko,
//           emailBisnis: t.emailBisnis,
//           nomorTelepon: t.nomorTelepon,
//           alamat: t.alamat,
//           kota: t.kota,
//           kodePos: t.kodePos,
//           persenPajak: t.persenPajak,
//           tipePajak: t.tipePajak,
//           idNPWP: t.idNPWP,
//           logoUrl: t.logoUrl,
//           footerStruk: t.footerStruk,
//           status: t.status,
//           isSetupComplete: t.isSetupComplete,
//         },
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // create tenant (pakai akun)
//   async create(req, res, next) {
//     try {
//       const userId = req.userDecoded?.id;

//       // FIX: tidak lagi butuh deviceID — generateTokens cukup pakai akun
//       if (!userId) {
//         throw createError(401, "Identitas akun tidak valid.");
//       }

//       const { tenant, akun } = await tenantService.createWithOwner(
//         req.body,
//         userId
//       );

//       // FIX: generateTokens sekarang hanya butuh akun (sudah update tokenVersion
//       // di tenantService.createWithOwner via Akun.findByIdAndUpdate)
//       const tokens = akunService.generateTokens(akun);
//       setRefreshTokenCookie(res, tokens.refreshToken);

//       res.status(201).json({
//         message: "Toko berhasil dibuat.",
//         data: {
//           _id: tenant._id,
//           namaToko: tenant.namaToko,
//           emailBisnis: tenant.emailBisnis,
//           nomorTelepon: tenant.nomorTelepon,
//           alamat: tenant.alamat,
//           kota: tenant.kota,
//           kodePos: tenant.kodePos,
//           persenPajak: tenant.persenPajak,
//           tipePajak: tenant.tipePajak,
//           idNPWP: tenant.idNPWP,
//           logoUrl: tenant.logoUrl,
//           footerStruk: tenant.footerStruk,
//           status: tenant.status,
//           isSetupComplete: tenant.isSetupComplete,
//         },
//         accessToken: tokens.accessToken,
//         refreshToken: tokens.refreshToken,
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // update tenant (rba + isolasi tenant)
//   async update(req, res, next) {
//     try {
//       const tenantID = req.pengguna?.tenantID;
//       const targetId = req.params.id;

//       if (!tenantID) {
//         throw createError(400, "Tenant tidak ditemukan pada pengguna.");
//       }

//       if (tenantID.toString() !== targetId) {
//         throw createError(403, "Tidak bisa mengubah tenant lain.");
//       }

//       const t = await tenantService.update(targetId, req.body);

//       if (t?.error) {
//         return res.status(400).json({ errors: t.error });
//       }

//       if (!t) throw createError(404, "Tenant tidak ditemukan.");

//       res.json({
//         message: "Data toko berhasil diperbarui.",
//         data: {
//           _id: t._id,
//           namaToko: t.namaToko,
//           emailBisnis: t.emailBisnis,
//           nomorTelepon: t.nomorTelepon,
//           alamat: t.alamat,
//           kota: t.kota,
//           kodePos: t.kodePos,
//           persenPajak: t.persenPajak,
//           tipePajak: t.tipePajak,
//           idNPWP: t.idNPWP,
//           logoUrl: t.logoUrl,
//           footerStruk: t.footerStruk,
//           status: t.status,
//           isSetupComplete: t.isSetupComplete,
//         },
//       });
//     } catch (err) {
//       next(err);
//     }
//   }

//   // delete tenant (permission)
//   async delete(req, res, next) {
//     try {
//       const tenantID = req.pengguna?.tenantID;
//       const targetId = req.params.id;

//       if (!tenantID) {
//         throw createError(400, "Tenant tidak ditemukan pada pengguna.");
//       }

//       if (tenantID.toString() !== targetId) {
//         throw createError(403, "Tidak bisa menghapus tenant lain.");
//       }

//       await tenantService.forceDelete(targetId);

//       res.json({
//         message: "Toko berhasil dihapus.",
//       });
//     } catch (err) {
//       next(err);
//     }
//   }
// }

// module.exports = new TenantController();





const tenantService = require("../services/tenantService");
const akunService = require("../services/akunService");
const createError = require("http-errors");

// perbaikan: path diubah ke root agar konsisten dengan middleware lainnya
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/", 
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class TenantController {

  // mengambil semua daftar tenant
  async getAll(req, res, next) {
    try {
      const tenants = await tenantService.getAll();

      // perbaikan: langsung mengirim data dari service tanpa pemetaan manual yang berulang
      res.json({
        message: "Daftar toko berhasil diambil.",
        total: tenants.length,
        data: tenants,
      });
    } catch (err) {
      next(err);
    }
  }

  // mengambil tenant berdasarkan id
  async getById(req, res, next) {
    try {
      const tenant = await tenantService.getById(req.params.id);
      if (!tenant) throw createError(404, "Tenant tidak ditemukan.");

      // perbaikan: mempermudah pengiriman data tanpa hardcoding field
      res.json({
        message: "Detail toko berhasil diambil.",
        data: tenant,
      });
    } catch (err) {
      next(err);
    }
  }

  // membuat tenant baru sekaligus registrasi owner
  async create(req, res, next) {
    try {
      // perbaikan: mengambil id dari akunContext sesuai middleware terbaru
      const akunID = req.userDecoded?.id;
      if (!akunID) throw createError(401, "Sesi akun tidak valid.");

      const result = await tenantService.createWithOwner(req.body, akunID);

      const { accessToken, refreshToken } = await akunService.generateTokens(result.akun);
      setRefreshTokenCookie(res, refreshToken);

      res.status(201).json({
        message: "Registrasi toko dan owner berhasil.",
        data: {
          tenant: result.tenant,
          owner: {
            id: result.akun._id,
            email: result.akun.email,
          },
          accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // memperbarui data tenant
  async update(req, res, next) {
    try {
      // [PERBAIKAN]: Ekstrak tenantID dari token Pengguna atau token Akun secara fleksibel
      const extractedTenantID = req.userDecoded?.tenantID || req.akunContext?.tenantID;
      const targetId = req.params.id;

      if (!extractedTenantID) {
        throw createError(403, "Akses ditolak. Tidak dapat mengidentifikasi asal toko Anda.");
      }

      // [PERBAIKAN]: Pastikan pengguna hanya bisa mengubah tokonya sendiri
      if (extractedTenantID.toString() !== targetId) {
        throw createError(403, "Anda tidak memiliki izin untuk mengubah data toko ini.");
      }

      const t = await tenantService.update(targetId, req.body);

      // perbaikan: penanganan error diringkas mengikuti standar service baru
      if (!t) throw createError(404, "Tenant tidak ditemukan.");

      res.json({
        message: "Data toko berhasil diperbarui.",
        data: t,
      });
    } catch (err) {
      next(err);
    }
  }

  // menghapus tenant secara permanen
  async delete(req, res, next) {
    try {
      // [PERBAIKAN]: Menggunakan logika ekstraksi tenantID yang selaras dengan update
      const extractedTenantID = req.userDecoded?.tenantID || req.akunContext?.tenantID;
      const targetId = req.params.id;

      if (!extractedTenantID) {
        throw createError(403, "Akses ditolak. Identitas toko tidak ditemukan.");
      }

      // [PERBAIKAN]: Memastikan pengguna tidak menghapus toko milik orang lain
      if (extractedTenantID.toString() !== targetId) {
        throw createError(403, "Tidak diizinkan menghapus toko milik pihak lain.");
      }

      await tenantService.forceDelete(targetId);

      res.json({ message: "Tenant dan seluruh data terkait berhasil dihapus secara permanen." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TenantController();