const Pengguna = require("../models/penggunaModel");
const RolePermission = require("../models/rolePermissionModel");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");
const { validateLoginPayload } = require("../validators/penggunaValidator");
const createError = require("http-errors");

const JWT_SECRET = process.env.PENGGUNA_JWT_SECRET || "pengguna_secret";
const REFRESH_SECRET = process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

class AuthService {
  
  // TOKEN GENERATORS
  generateAccessToken(user, permissions) {
    return jwt.sign(
      {
        id: user._id,
        nama: user.nama,
        roleID: user.roleID,
        tenantID: user.tenantID,
        version: user.tokenVersion,
        permissions: permissions,
      },
      JWT_SECRET,
      { expiresIn: "15m" } // Short lived
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      {
        id: user._id,
        tenantID: user.tenantID,
        version: user.tokenVersion,
      },
      REFRESH_SECRET,
      { expiresIn: "7d" } // Long lived
    );
  }

  // LOGIN LOGIC
  async loginPin(tenantID, pin) {
    const validation = validateLoginPayload({ tenantID, pin });
    if (!validation.valid) return { error: validation.errors };

    // Cari semua user di tenant ini
    // (Perlu fetch semua karena tidak tahu user mana yg punya PIN ini - PIN di-hash)
    const users = await Pengguna.find({ tenantID });
    
    let targetUser = null;
    
    // Brute-force match (Aman krn scope hanya 1 tenant, biasanya < 50 user)
    for (const user of users) {
      const isMatch = await user.comparePin(pin);
      if (isMatch) {
        targetUser = user;
        break;
      }
    }

    if (!targetUser) throw createError(401, "PIN Salah atau User tidak ditemukan");
    if (targetUser.status !== "aktif") throw createError(403, "Akun tidak aktif");

    // Ambil Permissions
    const rolePerms = await RolePermission.find({ roleID: targetUser.roleID }).populate("permissionID");
    const permissions = rolePerms.map(rp => rp.permissionID.nama);

    // Update Token Version (Invalidate old tokens)
    targetUser.tokenVersion = Math.floor(1000 + Math.random() * 9000);
    await targetUser.save();

    // Generate Tokens
    const accessToken = this.generateAccessToken(targetUser, permissions);
    const refreshToken = this.generateRefreshToken(targetUser);

    return {
      user: targetUser,
      permissions,
      accessToken,
      refreshToken
    };
  }

  // REFRESH TOKEN LOGIC
  async refreshToken(token) {
    if (!token) throw createError(401, "No token provided");

    let payload;
    try {
      payload = jwt.verify(token, REFRESH_SECRET);
    } catch (err) {
      throw createError(403, "Invalid Refresh Token");
    }

    const user = await Pengguna.findById(payload.id);
    if (!user || user.tokenVersion !== payload.version) {
      throw createError(401, "Session Expired");
    }

    // Rotate Token Version
    user.tokenVersion = Math.floor(1000 + Math.random() * 9000);
    await user.save();

    // Get Permissions again
    const rolePerms = await RolePermission.find({ roleID: user.roleID }).populate("permissionID");
    const permissions = rolePerms.map(rp => rp.permissionID.nama);

    return {
      accessToken: this.generateAccessToken(user, permissions),
      refreshToken: this.generateRefreshToken(user)
    };
  }

  // LOGOUT
  async logout(userID) {
    await Pengguna.findByIdAndUpdate(userID, { tokenVersion: 0 });
    // Invalidate cache
    await redis.del(`pengguna:detail:${userID}`);
    return true;
  }
}

module.exports = new AuthService();