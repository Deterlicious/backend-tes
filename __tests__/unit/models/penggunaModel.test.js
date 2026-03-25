const mongoose = require("mongoose");
const Pengguna = require("../../../models/penggunaModel");

// Skenario A (Skenario A: PIN harus ter-hash sebelum disimpan)
test("PIN harus di-hash bcrypt sebelum disimpan ke DB", async () => {
  const pengguna = new Pengguna({
    nama: "Budi Kasir",
    pin: "123456",
    roleID: new mongoose.Types.ObjectId(),
    tenantID: new mongoose.Types.ObjectId(),
  });

  await pengguna.save();

  expect(pengguna.pin).not.toBe("123456");
  expect(pengguna.pin).toMatch(/^\$2[aby]\$\d+\$/);
});

// Skenario B (comparePin harus return true untuk PIN yang benar)
test("comparePin harus return true untuk PIN yang cocok", async () => {
  const pengguna = new Pengguna({
    nama: "Siti Kasir",
    pin: "654321",
    roleID: new mongoose.Types.ObjectId(),
    tenantID: new mongoose.Types.ObjectId(),
  });
  await pengguna.save();

  const isMatch = await pengguna.comparePin("654321");
  expect(isMatch).toBe(true);

  const isWrong = await pengguna.comparePin("000000");
  expect(isWrong).toBe(false);
});
