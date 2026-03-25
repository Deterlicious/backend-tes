const mongoose = require("mongoose");
const Diskon = require("../../../models/diskonModel");

// Scenario A (Diskon persen > 100 harus gagal)
test("diskon bertipe persen > 100 harus throw ValidationError", async () => {
  const diskon = new Diskon({
    tenantID: new mongoose.Types.ObjectId(),
    namaDiskon: "Diskon Gila",
    cakupan: "Global",
    tipe: "persen",
    nilai: 150, // invalid
  });

  await expect(diskon.validate()).rejects.toThrow(
    "Diskon bertipe persen tidak boleh melebihi 100",
  );
});

// Scenario B (Diskon nominal dengan nilai valid harus lolos validasi)
test("diskon nominal dengan nilai valid harus lolos validasi", async () => {
  const diskon = new Diskon({
    tenantID: new mongoose.Types.ObjectId(),
    namaDiskon: "Promo Ramadan",
    cakupan: "Item",
    tipe: "nominal",
    nilai: 5000,
    bisaDigabung: true,
    status: "Aktif",
  });

  await expect(diskon.validate()).resolves.toBeUndefined();
});
