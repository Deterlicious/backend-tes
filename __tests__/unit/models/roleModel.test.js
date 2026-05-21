const mongoose = require("mongoose");
const Role = require("../../../models/roleModel");

describe("Unit Test Model — Role", () => {
  test("Skenario 1 — Harus berhasil divalidasi dengan data yang valid dan lengkap", () => {
    const validRole = new Role({
      tenantID: new mongoose.Types.ObjectId(),
      namaRole: "Owner",
      deskripsi: "Role dengan akses penuh",
      permissions: [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ],
    });

    const err = validRole.validateSync();
    expect(err).toBeUndefined();
  });

  test("Skenario 2 — Harus gagal validasi jika tenantID tidak diisi (Required)", () => {
    const invalidRole = new Role({
      namaRole: "Kasir",
    });

    const err = invalidRole.validateSync();
    expect(err.errors.tenantID).toBeDefined();
    expect(err.errors.tenantID.kind).toBe("required");
  });

  test("Skenario 3 — Harus gagal validasi jika namaRole tidak diisi (Required)", () => {
    const invalidRole = new Role({
      tenantID: new mongoose.Types.ObjectId(),
    });

    const err = invalidRole.validateSync();
    expect(err.errors.namaRole).toBeDefined();
    expect(err.errors.namaRole.kind).toBe("required");
  });

  test("Skenario 4 — Harus memotong (trim) spasi ekstra pada namaRole dan deskripsi", () => {
    const roleWithSpaces = new Role({
      tenantID: new mongoose.Types.ObjectId(),
      namaRole: "   Manager   ",
      deskripsi: "   Hak akses untuk manager toko   ",
    });

    expect(roleWithSpaces.namaRole).toBe("Manager");
    expect(roleWithSpaces.deskripsi).toBe("Hak akses untuk manager toko");
  });

  test("Skenario 5 — Harus memiliki nilai default null untuk deskripsi jika tidak diberikan", () => {
    const roleNoDesc = new Role({
      tenantID: new mongoose.Types.ObjectId(),
      namaRole: "Staff",
    });

    expect(roleNoDesc.deskripsi).toBeNull();
  });

  test("Skenario 6 — Harus melempar CastError jika permissions berisi data yang bukan ObjectId", () => {
    const invalidRole = new Role({
      tenantID: new mongoose.Types.ObjectId(),
      namaRole: "Admin",
      permissions: ["format_id_yang_salah"], 
    });

    const err = invalidRole.validateSync();
    expect(err.errors["permissions.0"]).toBeDefined();
    expect(err.errors["permissions.0"].name).toBe("CastError");
  });

  test("Skenario 7 — Harus menerima array kosong untuk permissions (Validasi tipe data murni)", () => {
    const roleEmptyPermissions = new Role({
      tenantID: new mongoose.Types.ObjectId(),
      namaRole: "Guest",
      permissions: [],
    });

    const err = roleEmptyPermissions.validateSync();
    expect(err).toBeUndefined();
    expect(roleEmptyPermissions.permissions).toHaveLength(0);
  });
});