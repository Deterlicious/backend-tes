const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mock dependencies sebelum require service
jest.mock("../../../models/penggunaModel");
jest.mock("../../../config/redis", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
}));
jest.mock("../../../models/roleModel");

const Pengguna = require("../../../models/penggunaModel");
const penggunaService = require("../../../services/penggunaService");

const REFRESH_SECRET = process.env.PENGGUNA_JWT_REFRESH_SECRET || "pengguna_refresh_secret";

describe("penggunaService - refreshToken (Fix Masalah 3)", () => {
  const tenantA = new mongoose.Types.ObjectId().toString();
  const tenantB = new mongoose.Types.ObjectId().toString();
  const userID = new mongoose.Types.ObjectId().toString();

  function makeRefreshToken(id, tenantID, version) {
    return jwt.sign({ id, tenantID, version }, REFRESH_SECRET, { expiresIn: "7d" });
  }

  afterEach(() => jest.clearAllMocks());

  test("tolak refresh jika tenantID di token tidak cocok dengan data pengguna", async () => {
    // Token dibuat dengan tenantA, tapi user di DB punya tenantB
    const token = makeRefreshToken(userID, tenantA, 100);

    Pengguna.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userID,
        tenantID: { toString: () => tenantB }, // beda tenant
        tokenVersion: 100,
        roleID: { _id: new mongoose.Types.ObjectId(), namaRole: "Staff" },
      }),
    });

    await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/tenant/i),
    });
  });

  test("tolak refresh jika tokenVersion tidak cocok", async () => {
    const token = makeRefreshToken(userID, tenantA, 100);

    Pengguna.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userID,
        tenantID: { toString: () => tenantA },
        tokenVersion: 999, // beda version
        roleID: { _id: new mongoose.Types.ObjectId(), namaRole: "Staff" },
      }),
    });

    await expect(penggunaService.refreshToken(token)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/sesi tidak valid/i),
    });
  });

  test("berhasil refresh jika tenantID dan tokenVersion cocok", async () => {
    const token = makeRefreshToken(userID, tenantA, 100);
    const mockUser = {
      _id: userID,
      tenantID: { toString: () => tenantA },
      tokenVersion: 100,
      roleID: { _id: new mongoose.Types.ObjectId(), namaRole: "Staff" },
    };

    Pengguna.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockUser),
    });

    const result = await penggunaService.refreshToken(token);
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
  });

  test("tolak jika token kosong", async () => {
    await expect(penggunaService.refreshToken(null)).rejects.toMatchObject({
      status: 401,
    });
  });

  test("tolak jika token tidak valid / expired", async () => {
    await expect(penggunaService.refreshToken("invalid.token.here")).rejects.toMatchObject({
      status: 403,
    });
  });
});