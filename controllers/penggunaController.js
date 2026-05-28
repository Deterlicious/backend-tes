const penggunaService = require("../services/penggunaService");
const createError = require("http-errors");
const { DEVICE_STATUS } = require("../config/constants");

// Standardisasi Cookie Mutlak: Nama "refreshToken" dan path "/"
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

class PenggunaController {
  _getRequesterContext(req) {
    if (req.akunContext)
      return { tenantID: req.akunContext.tenantID ?? null, source: "AKUN" };
    if (req.pengguna)
      return { tenantID: req.pengguna.tenantID, source: "PENGGUNA" };
    return null;
  }

  _ensureTenant(context) {
    if (!context || !context.tenantID) {
      throw createError(400, "Tenant tidak ditemukan.");
    }
    return context.tenantID;
  }

  // 1. register owner (BARU)
  async registerOwner(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context || context.source !== "AKUN") {
        throw createError(403, "Akses ditolak. Gunakan Akun SaaS.");
      }

      const tenantID = this._ensureTenant(context);

      // FIX: Menggunakan installationId dan metadata perangkat
      const {
        nama,
        pin,
        aksesType,
        installationId,
        deviceName,
        appVersion,
        osVersion,
      } = req.body;

      // Mendapatkan alamat IP untuk audit (lastIpAddress)
      const ipAddress =
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

      // Normalisasi aksesType agar selalu berupa array
      const normalizedAksesType = Array.isArray(aksesType)
        ? aksesType
        : [aksesType || "app"];

      // Validasi kewajiban installationId untuk akses aplikasi
      if (normalizedAksesType.includes("app") && !installationId) {
        throw createError(
          400,
          "installationId wajib disertakan untuk pendaftaran Owner via aplikasi.",
        );
      }

      // Payload disesuaikan dengan signature terbaru pada Service
      const payload = {
        nama,
        pin,
        aksesType: normalizedAksesType,
        installationId,
        deviceName,
        appVersion,
        osVersion,
        ipAddress,
      };

      const result = await penggunaService.registerOwner(payload, tenantID);

      // Pasang Refresh Token ke cookie (untuk kebutuhan akses web jika ada)
      setRefreshTokenCookie(res, result.refreshToken);

      res.status(201).json({
        success: true,
        message: "Owner berhasil didaftarkan.",
        data: {
          pengguna: result.pengguna,
          // Sertakan metadata perangkat yang otomatis terdaftar sebagai 'trusted'
          device: result.device || null,
        },
        accessToken: result.accessToken,
        // Mengirimkan Refresh Token di body untuk kemudahan Flutter Secure Storage
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      next(err);
    }
  }

  // 2. create pengguna biasa (BARU)
  async create(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      // FIX: Buang deviceID dan deviceType dari penerimaan body.
      // Owner/Admin tidak perlu tahu atau menginput ID perangkat saat membuat akun kasir.
      const { nama, pin, roleID, aksesType } = req.body;

      // Payload kini bersih, hanya fokus pada data identitas Pengguna
      const payload = { nama, pin, roleID, aksesType };

      const result = await penggunaService.create(payload, tenantID);

      res.status(201).json({
        success: true,
        message:
          "Pengguna berhasil dibuat. Pengguna baru ini dapat login menggunakan nama dan PIN yang telah ditetapkan.",
        data: result.pengguna,
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. get all
  async getAll(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.getAll(tenantID);

      res.json({
        message: "Daftar pengguna berhasil diambil.",
        total: result.length,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. get by id
  async getById(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      const result = await penggunaService.getById(req.params.id, tenantID);

      res.json({
        message: "Detail pengguna berhasil diambil.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. update
  async update(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      // Salin isi req.body agar tidak memanipulasi object bawaan Express
      const payload = { ...req.body };

      // Identifikasi siapa yang sedang melakukan request (dari token JWT di auth middleware)
      const requesterId = req.pengguna ? req.pengguna.id : null;
      const requesterRole = req.pengguna ? req.pengguna.role : null;
      const targetId = req.params.id;

      // PROTEKSI KEAMANAN: Cegah Manipulasi Mandiri oleh Staf Biasa
      if (requesterId === targetId && requesterRole !== "Owner") {
        // 1. Cegah bypass PIN. Staf HANYA boleh pakai pinLama & pinBaru
        if (payload.pin) {
          delete payload.pin;
        }

        // 2. Cegah Privilege Escalation (Staf menaikkan jabatan atau memanipulasi statusnya sendiri)
        if (payload.roleID) delete payload.roleID;
        if (payload.status) delete payload.status;
        if (payload.aksesType) delete payload.aksesType;
      }

      // Catatan: Jika requesterRole === "Owner", mereka bebas mengubah data staf lain (termasuk reset 'pin' langsung)

      const result = await penggunaService.update(targetId, payload, tenantID);

      res.json({
        message: "Data pengguna berhasil diperbarui.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // 6. login pin pengguna (BARU)
  async loginPin(req, res, next) {
    try {
      // 1. Ganti deviceID menjadi installationId dan menambahkan metadata untuk audit
      const {
        nama,
        pin,
        loginType,
        installationId,
        deviceName,
        appVersion,
        osVersion,
      } = req.body;

      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      // Ambil IP Address untuk kebutuhan audit/lastIpAddress
      const ipAddress =
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

      // 2. Memanggil Service Login
      // Logika Mongoose Transaction dan pengecekan kuota device akan berada di dalam service ini
      const result = await penggunaService.loginPin({
        nama,
        pin,
        tenantID,
        loginType,
        installationId,
        deviceName,
        appVersion,
        osVersion,
        ipAddress,
      });

      // 3. Penanganan Skenario Perangkat Pending
      // Jika perangkat baru didaftarkan atau masa pending diperbarui (expired)
      if (result.status === DEVICE_STATUS.PENDING) {
        return res.status(200).json({
          success: false,
          code: "DEVICE_PENDING_APPROVAL",
          message: "Perangkat menunggu persetujuan owner.",
          data: {
            installationId: result.device.installationId,
            pendingExpiresAt: result.device.pendingExpiresAt,
          },
        });
      }

      // 4. Penanganan Skenario Sukses
      // Pasang Refresh Token ke Cookie (Opsional, tergantung preferensi Flutter Sir)
      // Sesuai roadmap, refreshToken ini adalah Opaque Token yang sudah di-hash di DB
      setRefreshTokenCookie(res, result.refreshToken);

      const isApp = result.status === DEVICE_STATUS.TRUSTED;

      res.json({
        success: true,
        message: "Login berhasil.",
        data: {
          user: result.pengguna,
          ...(isApp && {
            device: {
              installationId: result.device.installationId,
              status: result.device.status,
            },
          }),
        },
        accessToken: result.accessToken,
        ...(isApp && { refreshToken: result.refreshToken }),
      });
    } catch (err) {
      // Error seperti DEVICE_REVOKED (401) atau DEVICE_LIMIT_EXCEEDED (403)
      // akan ditangkap oleh Global Error Handler
      next(err);
    }
  }

  // 7. refresh token (BARU
  async refreshToken(req, res, next) {
    try {
      // Deteksi jalur: Jika ada installationId, berarti ini dari Mobile App
      const { installationId } = req.body;
      const isMobileApp = !!installationId;

      let result;

      if (isMobileApp) {
        // ALUR APP (Roadmap V1 - Opaque Token)
        const opaqueToken = req.body.refreshToken;
        if (!opaqueToken) {
          throw createError(401, "Refresh token tidak ditemukan di body.");
        }

        // Ekstrak Expired Access Token dari Header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          throw createError(
            401,
            "Access Token kedaluwarsa tidak disertakan di header.",
          );
        }
        const expiredAccessToken = authHeader.split(" ")[1];

        // Eksekusi di Service
        result = await penggunaService.refreshToken({
          token: opaqueToken,
          expiredAccessToken,
          installationId,
        });
      } else {
        // ALUR WEB (JWT Cookie Lama)
        const token = req.cookies.refreshToken || req.body.refreshToken;
        if (!token) {
          throw createError(401, "Refresh token tidak ditemukan.");
        }
        // Eksekusi Service lama
        // result = await penggunaService.refreshToken(token);
        result = await penggunaService.refreshToken({
          token: req.cookies.refreshToken || req.body.refreshToken,
          expiredAccessToken: req.headers.authorization?.split(" ")[1],
          installationId: req.body.installationId,
        });

        // Kembalikan ke Cookie jika web
        setRefreshTokenCookie(res, result.newRefreshToken);
      }

      res.json({
        success: true,
        message: "Token berhasil diperbarui.",
        data: {
          accessToken: result.accessToken,
          // Untuk mobile, kirim Refresh Token baru via JSON Body
          ...(isMobileApp && { refreshToken: result.newRefreshToken }),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // 8. logout (BARU)
  async logout(req, res, next) {
    const cookieOptions = { path: "/", httpOnly: true };
    try {
      // Deteksi jalur berdasarkan keberadaan installationId di body (atau query)
      const { installationId } = req.body;
      const isMobileApp = !!installationId;

      if (isMobileApp) {
        // ALUR APP (Roadmap V1)
        // Kita butuh userId untuk memutus cache dengan composite key.
        // Di titik ini, asumsinya request ini lolos authMiddleware, jadi req.pengguna sudah terisi.
        // Jika tidak, sistem perlu mengirim userId dari frontend, atau mengekstraknya dari JWT.
        const userId = req.pengguna ? req.pengguna.id : null;

        if (!userId) {
          throw createError(
            400,
            "Sesi tidak valid atau userId tidak ditemukan.",
          );
        }

        // Minta Service untuk set null hash dan hapus in-memory cache
        await penggunaService.logout({
          token: req.cookies.refreshToken || req.body.refreshToken,
          accessToken: req.headers.authorization?.split(" ")[1],
          userId: req.pengguna ? req.pengguna.id : null,
          installationId: req.body.installationId,
        });
      } else {
        // ALUR WEB (Cookie Lama)
        const token = req.cookies.refreshToken || req.body.refreshToken;
        if (token) {
          // await penggunaService.logout(token); // Service lama (mungkin update tokenVersion web)
          await penggunaService.logout({
            token,
            accessToken: req.headers.authorization?.split(" ")[1],
            installationId: null,
          });
        }
      }

      // Hapus cookie (tidak efek ke App, tapi pembersihan yang aman untuk Web)
      res.clearCookie("refreshToken", cookieOptions);
      res.clearCookie("refreshToken", {
        path: "/api/akun/auth",
        httpOnly: true,
      }); // clear cookie akun sekalian
      res.json({ success: true, message: "Logout berhasil." });
    } catch (err) {
      res.clearCookie("refreshToken", cookieOptions);
      res.clearCookie("refreshToken", {
        path: "/api/akun/auth",
        httpOnly: true,
      });
      next(err);
    }
  }

  // 9. check owner
  async checkOwner(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      if (!context || context.source !== "AKUN") {
        throw createError(403, "Akses ditolak.");
      }
      const tenantID = this._ensureTenant(context);

      const hasOwner = await penggunaService.checkOwnerExists(tenantID);

      res.json({
        message: "Status owner berhasil diperiksa.",
        data: { hasOwner },
      });
    } catch (err) {
      next(err);
    }
  }

  // 10. delete
  async delete(req, res, next) {
    try {
      const context = this._getRequesterContext(req);
      const tenantID = this._ensureTenant(context);

      await penggunaService.delete(req.params.id, tenantID);

      res.json({ message: "Pengguna berhasil dihapus." });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PenggunaController();
